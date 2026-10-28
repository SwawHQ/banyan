import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import {toolExecutable} from '../../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {extractElementText} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

import {fixtureEnvironment,fixtureSiteMounts,directoryPage} from '../_shared/hugo.mjs';

const root = process.cwd();
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'banyan-path-rebuild-'));

try {
    const relative = (value) => path.relative(root, value).replaceAll('\\', '/');
    const overlay = path.join(work, 'content');
    await fs.mkdir(path.join(overlay, 'd'), { recursive: true });
    const locales = [['', ''], ['.zh', '/zh'], ['.zh-tw', '/zh-tw']];
    const originals = new Map();
    for (const [suffix] of locales) {
        const source = directoryPage('Content');
        originals.set(suffix, source);
        await fs.writeFile(path.join(overlay, `d/_index${suffix}.md`), source.replace(/^title:.*$/m, 'title: Before rename'));
        await fs.writeFile(path.join(overlay, `d/path-rebuild-probe${suffix}.md`),
            '---\ntitle: Path rebuild probe\nurl: d/banyan-path-rebuild-probe/\ndate: 2026-01-01\n---\nSynthetic article for the ancestor title contract.\n');
    }
    const config = path.join(work, 'overlay.toml');
    await fs.writeFile(config, `[[module.mounts]]\nsource = "${relative(overlay)}"\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`+fixtureSiteMounts);
    const portProbe = net.createServer();
    await new Promise((resolve, reject) => {
        portProbe.once('error', reject);
        portProbe.listen(0, '127.0.0.1', resolve);
    });
    const port = portProbe.address().port;
    await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
    const base = `http://127.0.0.1:${port}`;
    const server = spawn(toolExecutable('hugo'), ['--noBuildLock',
        'server', '--config', `hugo.toml,${relative(config)}`, '--bind', '127.0.0.1',
        '--port', String(port), '--baseURL', base, '--disableLiveReload',
        '--enableGitInfo=false', '--destination', relative(path.join(work, 'public')),
    ], { cwd: root, env:fixtureEnvironment(work), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    let launchError;
    server.on('error', (error) => { launchError = error; });
    server.stdout.on('data', (chunk) => { logs += chunk; });
    server.stderr.on('data', (chunk) => { logs += chunk; });
    async function html(url) {
        const response = await fetch(base + url, {
            signal: AbortSignal.timeout(2000), headers: { Connection: 'close' },
        });
        assert.equal(response.status, 200, url);
        return response.text();
    }
    async function until(check) {
        const deadline = Date.now() + 20000;
        let lastError;
        while (Date.now() < deadline) {
            if (launchError) throw launchError;
            if (server.exitCode !== null) throw new Error(logs);
            try { if (await check()) return; } catch (error) { lastError = error; }
            await delay(200);
        }
        throw new Error(`Preview did not reach expected state. ${lastError || ''}\n${logs}`);
    }
    function directoryLabel(document) {
        const row = document.match(/<nav class="document-meta__row document-meta__row--path"[\s\S]*?<\/nav>/)?.[0];
        const link = row?.match(/<a\b[^>]*href="(?:\/zh|\/zh-tw)?\/d\/"[^>]*>[\s\S]*?<\/a>/)?.[0] || '';
        return extractElementText(link, 'a');
    }
    try {
        await until(async () => (await html('/zh/d/')).includes('Before rename'));
        for (const [, prefix] of locales) {
            assert.equal(directoryLabel(await html(`${prefix}/d/banyan-path-rebuild-probe/`)), 'Before rename');
        }
        for (const [suffix] of locales) {
            await fs.writeFile(path.join(overlay, `d/_index${suffix}.md`), originals.get(suffix).replace(/^title:.*$/m, 'title: After rename'));
        }
        for (const [, prefix] of locales) {
            await until(async () => (await html(`${prefix}/d/`)).includes('data-current-page-title="After rename"'));
            await until(async () => directoryLabel(await html(`${prefix}/d/banyan-path-rebuild-probe/`)) === 'After rename');
        }
        console.log('PASS ancestor title changes reach document metadata during incremental rebuilds in all three languages.');
    } finally {
        if (server.exitCode === null && server.pid) {
            const exited = new Promise((resolve) => server.once('exit', resolve));
            if (process.platform === 'win32') {
                // Package-manager launchers may spawn a separate Hugo executable.
                const stopped = spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { windowsHide: true });
                assert.equal(stopped.status, 0, String(stopped.stderr || stopped.error || 'Could not stop test Hugo process tree.'));
            } else {
                server.kill();
            }
            await exited;
        }
    }
} finally {
    await fs.rm(work,{recursive:true,force:true});
}
