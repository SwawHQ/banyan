import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveHugoCommand } from '../build/hugo-command.mjs';

const root = process.cwd();
await fs.mkdir(path.join(root, 'temp_workspace'), { recursive: true });
const work = await fs.mkdtemp(path.join(root, 'temp_workspace', 'path-rebuild-'));
const relative = (value) => path.relative(root, value).replaceAll('\\', '/');
const overlay = path.join(work, 'content');
await fs.mkdir(path.join(overlay, 'd'), { recursive: true });
const locales = [['', ''], ['.zh', '/zh'], ['.zh-tw', '/zh-tw']];
const originals = new Map();
for (const [suffix] of locales) {
    const source = await fs.readFile(path.join(root, `themes/banyan/content/d/_index${suffix}.md`), 'utf8');
    originals.set(suffix, source);
    await fs.writeFile(path.join(overlay, `d/_index${suffix}.md`), source.replace(/^title:.*$/m, 'title: Before rename'));
}
const config = path.join(work, 'overlay.toml');
await fs.writeFile(config, `[[module.mounts]]\nsource = "${relative(overlay)}"\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`);
const portProbe = net.createServer();
await new Promise((resolve, reject) => {
    portProbe.once('error', reject);
    portProbe.listen(0, '127.0.0.1', resolve);
});
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
const base = `http://127.0.0.1:${port}`;
const server = spawn(resolveHugoCommand({ cwd: root }), [
    'server', '--config', `hugo.toml,${relative(config)}`, '--bind', '127.0.0.1',
    '--port', String(port), '--baseURL', base, '--disableLiveReload',
    '--enableGitInfo=false', '--destination', relative(path.join(work, 'public')),
], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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
    return row?.match(/<a\b[^>]*href="(?:\/zh|\/zh-tw)?\/d\/"[^>]*>([^<]*)<\/a>/)?.[1];
}
try {
    await until(async () => (await html('/zh/d/')).includes('Before rename'));
    for (const [, prefix] of locales) {
        assert.equal(directoryLabel(await html(`${prefix}/p/coskill-trustworthy-collaboration/`)), 'Before rename');
    }
    for (const [suffix] of locales) {
        await fs.writeFile(path.join(overlay, `d/_index${suffix}.md`), originals.get(suffix).replace(/^title:.*$/m, 'title: After rename'));
    }
    for (const [, prefix] of locales) {
        await until(async () => (await html(`${prefix}/d/`)).includes('data-current-page-title="After rename"'));
        await until(async () => directoryLabel(await html(`${prefix}/p/coskill-trustworthy-collaboration/`)) === 'After rename');
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
    await fs.writeFile(path.join(work, 'hugo.log'), logs);
    console.log(`Artifacts: ${relative(work)}`);
}
