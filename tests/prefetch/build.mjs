// Compile the consuming site's real content; fixtures use a temporary directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {toolExecutable} from '../../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import { verifyCspOutput } from '../../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';

import {fixtureEnvironment} from '../_shared/hugo.mjs';

const siteRoot = process.cwd();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'banyan-speculation-contract-'));

try {
    const hugo = toolExecutable('hugo');
    const env = fixtureEnvironment(work);
    const rel = file => path.relative(siteRoot, file).replaceAll('\\', '/');
    const read = file => fs.readFileSync(file, 'utf8');
    const headerConfig = `[speculation_rules]
    mode = "header"
    nav = "prefetch_moderate"
    crumb = "prerender_conservative"
    sort_siblings = "off"
    descendants = "off"
    post = "off"
    `;

    function build(name, policy, output = path.join(work, name), expectedError = '', config = '') {
        const configFile = path.join(work, name + '.toml');
        const data = path.join(work, name + '-data');
        fs.mkdirSync(data,{recursive:true});
        fs.writeFileSync(path.join(data,'delivery.toml'),policy);
        fs.writeFileSync(configFile,config+'\n[[module.mounts]]\nsource = '+JSON.stringify(data.replaceAll('\\','/'))+
            '\ntarget = "data"\n[[module.mounts]]\nsource = "data"\ntarget = "data"\n');
        const result = spawnSync(hugo, ['--noBuildLock',
            '--config', 'hugo.toml,' + rel(configFile), '--minify',
            '--cleanDestinationDir', '--destination', rel(output)
        ], {cwd:siteRoot, env, encoding:'utf8', maxBuffer:8 * 1024 * 1024});
        const log = (result.stdout || '') + (result.stderr || '');
        assert.ifError(result.error);
        if (expectedError) {
            assert.notEqual(result.status, 0, name + ' must fail');
            assert.ok(log.includes(expectedError), log);
        } else {
            assert.equal(result.status, 0, log);
            assert.equal(fs.existsSync(path.join(output, '__speculation-rules-manifests')), false,
                'No intermediate manifests may be published');
        }
        return {output, log};
    }
    function routes(output) {
        return JSON.parse(read(path.join(output, 'edgeone.json'))).headers;
    }
    function ruleHeader(output) {
        const values = routes(output).find(route => route.source === '/*').headers
            .filter(header => header.key === 'Speculation-Rules');
        assert.ok(values.length <= 1);
        return values[0]?.value || '';
    }
    function verifyOff(output) {
        assert.equal(ruleHeader(output), '');
        assert.equal(read(path.join(output, '_headers')).includes('Speculation-Rules:'), false);
        assert.equal(routes(output).some(route => route.source.includes('/site/speculation-rules/')), false);
        const dir = path.join(output, 'site', 'speculation-rules');
        assert.equal(fs.existsSync(dir) ? fs.readdirSync(dir).length : 0, 0, 'No stale rules files');
    }
    function verifyHeader(output) {
        assert.equal(fs.existsSync(path.join(output, 'speculation-rules')), false, 'No former root-level rules directory');
        const value = ruleHeader(output);
        assert.match(value, /^"\/site\/speculation-rules\/document\.[a-f0-9]{64}\.json"$/);
        const url = JSON.parse(value);
        assert.ok(read(path.join(output, '_headers')).includes('Speculation-Rules: ' + value));
        const dir = path.join(output, 'site', 'speculation-rules');
        assert.equal(fs.readdirSync(dir).length, 1, 'Exactly one shared rules file');
        const body = fs.readFileSync(path.join(output, url.slice(1)));
        assert.ok(url.includes(createHash('sha256').update(body).digest('hex')), 'Fingerprint matches published bytes');
        assert.deepEqual(JSON.parse(body), {
            prefetch:[{source:'document', where:{selector_matches:'a[data-prefetch-slot="nav"]'}, eagerness:'moderate'}],
            prerender:[{source:'document', where:{selector_matches:'a[data-prefetch-slot="crumb"]'}, eagerness:'conservative'}]
        });
        const assetRoute = routes(output).find(route => route.source === '/site/speculation-rules/*');
        assert.ok(assetRoute);
        assert.deepEqual(Object.fromEntries(assetRoute.headers.map(header => [header.key, header.value])), {
            'Content-Type':'application/speculationrules+json'
        });
        return value;
    }

    verifyOff(build('off', '[speculation_rules]\nmode = "off"\n').output);
    const enabled = build('header', headerConfig);
    const value = verifyHeader(enabled.output);
    for (const language of ['zh', 'zh-tw']) {
        assert.ok(read(path.join(enabled.output, language, 'index.html')).includes('data-prefetch-slot'),
            'Shared selectors match links in every language');
    }
    verifyCspOutput(enabled.output);
    assert.equal(verifyHeader(build('repeat', headerConfig).output), value, 'Identical rules keep their URL');
    const changed = build('changed', headerConfig.replace('prefetch_moderate', 'prefetch_eager'));
    assert.notEqual(ruleHeader(changed.output), value, 'Rule changes invalidate the fingerprint');
    verifyOff(build('empty', headerConfig.replace('prefetch_moderate', 'off').replace('prerender_conservative', 'off')).output);
    verifyOff(build('disabled-after-header', '[speculation_rules]\nmode = "off"\n', enabled.output).output);
    build('language-mismatch', headerConfig, undefined, 'params.speculation_rules is not supported',
        '\n[languages.zh.params.speculation_rules]\nnav = "prefetch_eager"\n');
    build('language-disabled', headerConfig, undefined, 'params.speculation_rules is not supported',
        '\n[languages.zh.params.speculation_rules]\nmode = "off"\n');
    build('invalid-mode', '[speculation_rules]\nmode = "invalid"\n',
        undefined, 'delivery.speculation_rules.mode only supports off/header');
    const warning = build('overlap', '[service_worker]\nmode = "enable"\n[prefetch_runtime]\nmode = "enable"\n' +
        headerConfig + 'runtime_coordination = "independent"\n',undefined,'','panicOnWarning = false\n');
    assert.ok(warning.log.includes('Speculation overlap warning'), 'Overlap diagnostics survive removal of the collector');
    console.log('Speculation Rules contracts passed: direct output, CSP preservation, stable/changed fingerprints, off/empty/cleanup, language validation and overlap diagnostics.');
} finally {
    fs.rmSync(work,{recursive:true,force:true});
}
