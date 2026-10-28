// Exercise the actual consuming site; fixtures and output use a temporary directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {toolExecutable} from '../../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import { verifyCspOutput } from '../../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {inspect as inspectSri} from '../../.agents/skills/swaw-banyan/tasks/check/sri/inspect.mjs';
import {verifyRetiredOutput} from '../output/retired.mjs';

import {fixtureEnvironment,fixtureSiteMounts} from '../_shared/hugo.mjs';

const root = process.cwd();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'banyan-csp-contract-'));

try {
    const rel = file => path.relative(root, file).replaceAll('\\', '/');
    const hugo = toolExecutable('hugo');
    const env = fixtureEnvironment(work);
    const read = file => fs.readFileSync(file, 'utf8');

    function build(name, extraConfig = '', flags = ['--minify']) {
        const config = path.join(work, name + '.toml');
        fs.writeFileSync(config, extraConfig);
        const output = path.join(work, name);
        const result = spawnSync(hugo, ['--noBuildLock','--config', 'hugo.toml,' + rel(config), '--destination', rel(output), ...flags],
            { cwd: root, env, encoding: 'utf8', windowsHide: true });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return output;
    }
    function scriptPolicy(output) {
        return JSON.parse(read(path.join(output, 'edgeone.json'))).headers
            .find(route => route.source === '/*').headers.find(header => header.key === 'Content-Security-Policy').value;
    }

    const production = build('production');
    const summary = verifyCspOutput(production);
    assert.deepEqual((await inspectSri(production)).issues,[]);
    await verifyRetiredOutput(production);
    assert.equal(summary.uniqueHashes, 6, 'Five executable entries and native rules are exercised by the real site');
    assert.equal(fs.existsSync(path.join(production, '__csp')), false, 'Hash-only resources are never published');
    assert.equal(scriptPolicy(build('without-html-minify', '', [])), scriptPolicy(production),
        'HTML minification cannot change the CSP policy or its script bytes');
    const wrongConfig = build('wrong-config', '[minify]\ndisableJS = false\n');
    assert.throws(() => verifyCspOutput(wrongConfig), /CSP does not allow final inline script/,
        'Verification must detect accidental secondary JS minification');

    const overlay = path.join(work, 'assets/js/inline');
    fs.mkdirSync(overlay, { recursive: true });
    const sourceRoot = fileURLToPath(new URL('../../module/assets/js/inline/', import.meta.url));
    fs.writeFileSync(path.join(overlay, 'theme-boot.js'), read(path.join(sourceRoot, 'theme-boot.js'))
        + '\nwindow.__banyanCspContract = "changed";\n');
    const changed = build('changed', '[[module.mounts]]\nsource = "' + rel(path.join(work, 'assets'))
        + '"\ntarget = "assets"\n[[module.mounts]]\nsource = "assets"\ntarget = "assets"\n'+fixtureSiteMounts);
    verifyCspOutput(changed);
    assert.notEqual(scriptPolicy(changed), scriptPolicy(production), 'Changing source automatically updates CSP hashes');

    const socket = net.createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const output = path.join(work, 'server');
    const server = spawn(hugo, ['--noBuildLock','server', '--bind', '127.0.0.1', '--port', String(port),
        '--disableLiveReload', '--disableFastRender', '--destination', rel(output)],
        { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { log = (log + chunk).slice(-65536); });
    server.on('error', error => { log += String(error); });
    try {
        const started = Date.now();
        while (true) {
            try {
                const response = await fetch('http://127.0.0.1:' + port + '/', {
                    headers: { Connection: 'close' }, signal: AbortSignal.timeout(1000)
                });
                await response.arrayBuffer();
                if (response.ok) break;
            } catch { /* Wait for the initial render. */ }
            assert.ok(server.exitCode === null && Date.now() - started < 15000, log);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        verifyCspOutput(output);
        assert.notEqual(scriptPolicy(output), scriptPolicy(production), 'Development hashes describe unminified JS');
        const changedFile = path.join(output, 'index.html');
        fs.writeFileSync(changedFile, read(changedFile).replace('<script>', '<script>window.__unexpectedInline = true;'));
        assert.throws(() => verifyCspOutput(output), /CSP does not allow final inline script/,
            'Verification must reject unregistered or modified final inline scripts');
    } finally {
        server.kill();
        if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
        server.stdout.destroy();
        server.stderr.destroy();
    }
    console.log('CSP build contracts passed: ' + JSON.stringify(summary));
} finally {
    fs.rmSync(work,{recursive:true,force:true});
}
