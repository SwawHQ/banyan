// Build the consuming site's real content; all configuration and asset fixtures
// use a temporary directory instead of changing the root demo or module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import {loadChromium,loadWebkit} from '../../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {toolExecutable} from '../../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import { verifyCspOutput } from '../../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {createStaticSiteServer} from '../../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {check as checkContrast} from '../../.agents/skills/swaw-banyan/tasks/check/browser/palette/contrast/check.mjs';
import {check as checkRoles} from '../../.agents/skills/swaw-banyan/tasks/check/browser/palette/roles/check.mjs';

import {fixtureEnvironment,fixtureSiteMounts} from '../_shared/hugo.mjs';

const root = process.cwd();
const workRoot = path.join(os.tmpdir(), 'swaw/banyan/module-organization-fixes/palette');
fs.mkdirSync(workRoot, {recursive:true});
const work = fs.mkdtempSync(path.join(workRoot, 'contract-'));

try {
    const rel = file => path.relative(root, file).replaceAll('\\', '/');
    const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

    const hugo = toolExecutable('hugo');
    function build(name, config = '', expectedError) {
        const configFile = path.join(work, `${name}.toml`);
        const output = path.join(work, name);
        write(configFile, config);
        const result = spawnSync(hugo, ['--noBuildLock','--config', `hugo.toml,${rel(configFile)}`, '--minify', '--destination', rel(output)],
            { cwd: root, env: fixtureEnvironment(work), encoding: 'utf8', windowsHide: true });
        assert.ifError(result.error);
        const log = result.stdout + result.stderr;
        if (expectedError) {
            assert.notEqual(result.status, 0, `${name} must fail the build.`);
            assert(log.includes('params.appearance.palette') && log.includes(expectedError), log);
            return;
        }
        assert.equal(result.status, 0, log);
        verifyCspOutput(output);
        return output;
    }
    const paletteConfig = value => `[params.appearance]\npalette = ${value}\n`;
    const pageCss = (output, route = 'zh/about') => {
        const html = fs.readFileSync(path.join(output, route, 'index.html'), 'utf8');
        const href = html.match(/href=["']?(\/css\/page\.[^\s"'>]+\.css)/)?.[1];
        assert(href, 'The page must retain its single fingerprinted page CSS bundle.');
        return { href, text: fs.readFileSync(path.join(output, href), 'utf8') };
    };

    // Let Hugo resolve the configured site asset through its mounts.
    write(path.join(work, 'content/_res/palette-source/index.md'),
        '---\ntitle: Palette source\nurl: _res/palette-source/\nlayout: palette-source\noutputs: [HTML]\n---\n');
    write(path.join(work, 'layouts/palette-source.html'), `
{{ $path := strings.TrimSpace .Site.Params.appearance.palette }}
{{ $palette := resources.Get $path }}
{{ $source := resources.FromString "__palette-source.json" (dict "path" $path "css" $palette.Content | jsonify) }}
{{ $source.RelPermalink }}
`);
    const probeMounts = `[[module.mounts]]\nsource = "${rel(path.join(work, 'content'))}"\ntarget = "content"\n`
        + '[[module.mounts]]\nsource = "content"\ntarget = "content"\n'
        + `[[module.mounts]]\nsource = "${rel(path.join(work, 'layouts'))}"\ntarget = "layouts"\n`+fixtureSiteMounts;
    const normal = build('configured', probeMounts);
    const {path:palettePath,css:paletteCss} = JSON.parse(fs.readFileSync(path.join(normal, '__palette-source.json'), 'utf8'));
    const explicit = build('explicit', paletteConfig(JSON.stringify(` ${palettePath} `)));
    assert.deepEqual(pageCss(explicit), pageCss(normal), 'Whitespace around a palette path does not change its CSS.');
    const highContrast = build('high-contrast', paletteConfig('"site/theme.high-contrast.css"'));
    assert.notEqual(pageCss(highContrast).href, pageCss(normal).href, 'Site-owned high-contrast and default palettes produce separate CSS bundles.');

    const overlay = path.join(work, 'assets');
    const customPath = `__palette-test/${path.basename(work)}.css`;
    write(path.join(overlay, palettePath), paletteCss.replace(/--accent:\s*[^;]+;/, '--accent: #123456;')
        .replace(/--prose-heading-border:\s*[^;]+;/, '--prose-heading-border: #31547a;'));
    write(path.join(overlay, customPath), paletteCss.replace(/--accent:\s*[^;]+;/, '--accent: #234567;')
        .replace(/--list-header-border:\s*[^;]+;/, '--list-header-border: #9c334f;'));
    write(path.join(overlay, 'invalid.txt'), 'This is not CSS.');
    const mounts = fixtureSiteMounts+`[[module.mounts]]\nsource = "${rel(overlay)}"\ntarget = "assets"\n`;
    const overridden = build('site-override', paletteConfig(JSON.stringify(palettePath)) + mounts);
    assert.equal(pageCss(overridden).text.match(/--accent:\s*([^;}]+)/)?.[1].trim(), '#123456', 'An overlay must replace the configured site palette at the same asset path.');
    const custom = build('custom', paletteConfig(JSON.stringify(customPath)) + mounts);
    assert.equal(pageCss(custom).text.match(/--accent:\s*([^;}]+)/)?.[1].trim(), '#234567', 'A custom path resolves in the site assets filesystem.');
    assert.notEqual(pageCss(custom).href, pageCss(normal).href, 'Selecting a different palette changes the CSS fingerprint.');
    assert.equal((pageCss(custom).text.match(/--accent:/g) || []).length, (pageCss(normal).text.match(/--accent:/g) || []).length,
        'Selecting a palette must not load the default palette as well.');
    const multilingual = build('language-override', paletteConfig(JSON.stringify(palettePath)) + mounts
        + '[languages.zh.params.appearance]\npalette = '+JSON.stringify(customPath)+'\n');
    assert.equal(pageCss(multilingual).href, pageCss(custom).href);
    assert.equal(pageCss(multilingual, 'about').href, pageCss(overridden, 'about').href, 'Language palettes must not share the wrong cached CSS bundle.');

    for (const [name, value, message] of [
        ['missing', '"css/missing-palette.css"', 'was not found under assets/'],
        ['empty', '"  "', 'must be a non-empty CSS asset path'],
        ['boolean', 'false', 'must be a non-empty CSS asset path'],
        ['array', JSON.stringify([palettePath]), 'must be a non-empty CSS asset path'],
        ['not-css', '"invalid.txt"', 'must reference a CSS resource']
    ]) build(`invalid-${name}`, paletteConfig(value) + mounts, message);

    for (const engine of [loadChromium(), loadWebkit()]) {
        const browser = await engine.launch({executablePath:engine.executablePath()});
        try {
            for (const [name, output] of [['configured', normal], ['high-contrast', highContrast], ['site-override', overridden], ['custom', custom]]) {
                const server = await createStaticSiteServer(output);
                await server.start();
                let page;
                try {
                    page = await browser.newPage({ viewport: { width: 1500, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
                    const args = {page,baseUrl:server.getBaseUrl(),options:{page:'/zh/about/',min:4.5}};
                    const contrast = await checkContrast(args);
                    // Preserve the theme's historical 5:1 margin as a source regression guard.
                    for (const {mode,measurements} of contrast.modes) {
                        for (const {role,ratio} of measurements) {
                            const corrected = role==='deleted' || (mode==='light' && role==='type')
                                || (mode==='dark' && ['keyword','string'].includes(role));
                            if (corrected) assert(ratio>=5,mode+': '+role+' must retain its 5:1 margin.');
                        }
                    }
                    if (engine.name() === 'chromium') await checkRoles(args);
                    await page.goto(server.getBaseUrl()+'/zh/about/',{waitUntil:'load'});
                    for (const mode of ['light', 'dark']) {
                        await page.evaluate(mode => document.documentElement.dataset.theme = mode, mode);
                        const borders = await page.evaluate(() => {
                            const fixture = document.createElement('div');
                            fixture.innerHTML = '<div class="prose"><h1>Heading</h1></div>'
                                + '<div class="item-list"><div class="list-item list-header">List header</div></div>'
                                + '<span></span>';
                            fixture.lastElementChild.style.borderBottom = '1px solid color-mix(in srgb,var(--fg) 20%,transparent)';
                            document.body.append(fixture);
                            const border = selector => getComputedStyle(fixture.querySelector(selector)).borderBottomColor;
                            const colors = {heading:border('h1'),list:border('.list-header'),previous:border('span')};
                            fixture.remove();
                            return colors;
                        });
                        assert.equal(borders.heading, name === 'site-override' ? 'rgb(49, 84, 122)' : borders.previous,
                            `${engine.name()} ${name} ${mode}: the heading uses its own palette role.`);
                        assert.equal(borders.list, name === 'custom' ? 'rgb(156, 51, 79)' : borders.previous,
                            `${engine.name()} ${name} ${mode}: the list header uses its own palette role.`);
                        await page.screenshot({ path: path.join(work, `${engine.name()}-${name}-${mode}.png`), animations: 'disabled' });
                    }
                    console.log(`[PASS] ${engine.name()}: ${name} light/dark palette styles and contrast`);
                } finally { try { if (page) await page.close(); } finally { await server.stop(); } }
            }
        } finally { await browser.close(); }
    }

    console.log(`Palette configuration, asset overrides, and browser checks passed.`);
} finally {
    assert.equal(path.dirname(fs.realpathSync.native(work)), fs.realpathSync.native(workRoot));
    fs.rmSync(work,{recursive:true,force:true});
}
