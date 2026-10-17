// Build the consuming site's real content; all configuration and asset fixtures
// use a temporary directory instead of changing the root demo or module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import {loadChromium,loadWebkit} from '../../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {toolExecutable} from '../../.agents/skills/swaw-banyan/tasks/_shared/toolchain/operations.mjs';
import { verifyCspOutput } from '../../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {createStaticSiteServer} from '../../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {check as checkContrast} from '../../.agents/skills/swaw-banyan/tasks/check/browser/palette/contrast/check.mjs';
import {check as checkRoles} from '../../.agents/skills/swaw-banyan/tasks/check/browser/palette/roles/check.mjs';

import {fixtureEnvironment} from '../_shared/hugo.mjs';

const root = process.cwd();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'banyan-palette-contract-'));

try {
    const rel = file => path.relative(root, file).replaceAll('\\', '/');
    const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
    const readPalette = name => fs.readFileSync(`module/assets/css/${name}.css`, 'utf8');
    const defaultCss = readPalette('theme');
    const monochromeCss = readPalette('theme-monochrome');
    const declarations = css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .flatMap(([, selector, body]) => [...body.matchAll(/(--[\w-]+)\s*:/g)]
            .map(([, role]) => [selector.trim(), role]));
    // A palette may add private variables and state overrides; every public role must remain.
    const monochromeRoles = new Set(declarations(monochromeCss).map(String));
    for (const role of declarations(defaultCss).map(String)) {
        assert.ok(monochromeRoles.has(role), 'Monochrome palette is missing a shared color role: ' + role);
    }

    const hugo = toolExecutable('hugo');
    function build(name, config = '', expectedError) {
        const configFile = path.join(work, `${name}.toml`);
        const output = path.join(work, name);
        write(configFile, config);
        const result = spawnSync(hugo, ['--noBuildLock','--config', `hugo.toml,${rel(configFile)}`, '--minify', '--destination', rel(output)],
            { cwd: root, env: fixtureEnvironment(work), encoding: 'utf8', windowsHide: true });
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

    // The consuming site may already select another palette; keep fixtures explicit.
    const normal = build('default', paletteConfig('"css/theme.css"'));
    const explicit = build('explicit-default', paletteConfig('" css/theme.css "'));
    assert.deepEqual(pageCss(explicit), pageCss(normal), 'Whitespace around a palette path does not change its CSS.');
    const monochrome = build('monochrome', paletteConfig('"css/theme-monochrome.css"'));
    assert.notEqual(pageCss(monochrome).href, pageCss(normal).href, 'Selecting a different palette changes the CSS fingerprint.');
    assert.equal((pageCss(monochrome).text.match(/--accent:/g) || []).length, 2, 'Only one palette supplies the light/dark defaults.');

    const overlay = path.join(work, 'assets');
    write(path.join(overlay, 'css/theme.css'), defaultCss.replace(/--accent:\s*[^;]+;/, '--accent: #123456;'));
    write(path.join(overlay, 'css/custom.css'), monochromeCss.replace(/--accent:\s*[^;]+;/, '--accent: #234567;'));
    write(path.join(overlay, 'invalid.txt'), 'This is not CSS.');
    const mounts = `[[module.mounts]]\nsource = "${rel(overlay)}"\ntarget = "assets"\n[[module.mounts]]\nsource = "assets"\ntarget = "assets"\n`;
    const overridden = build('site-override', paletteConfig('"css/theme.css"') + mounts);
    assert(pageCss(overridden).text.includes('--accent:#123456'), 'Hugo must prefer a same-path site asset over the theme asset.');
    const custom = build('custom', paletteConfig('"css/custom.css"') + mounts);
    assert(pageCss(custom).text.includes('--accent:#234567'), 'A custom path resolves in the site assets filesystem.');
    const multilingual = build('language-override', paletteConfig('"css/theme.css"')
        + '[languages.zh.params.appearance]\npalette = "css/theme-monochrome.css"\n');
    assert.equal(pageCss(multilingual).href, pageCss(monochrome).href);
    assert.equal(pageCss(multilingual, 'about').href, pageCss(normal, 'about').href, 'Language palettes must not share the wrong cached CSS bundle.');

    for (const [name, value, message] of [
        ['missing', '"css/missing-palette.css"', 'was not found under assets/'],
        ['empty', '"  "', 'must be a non-empty CSS asset path'],
        ['boolean', 'false', 'must be a non-empty CSS asset path'],
        ['array', '["css/theme.css"]', 'must be a non-empty CSS asset path'],
        ['not-css', '"invalid.txt"', 'must reference a CSS resource']
    ]) build(`invalid-${name}`, paletteConfig(value) + mounts, message);

    const scopes = new Map();
    for (const [selector, role] of declarations(defaultCss)) {
        const base = selector.replace(':root[data-theme="dark"]', ':root').replace('[data-theme="dark"] ', '');
        if (!scopes.has(base)) scopes.set(base, new Set());
        scopes.get(base).add(role);
    }
    for (const engine of [loadChromium(), loadWebkit()]) {
        const browser = await engine.launch({executablePath:engine.executablePath()});
        try {
            for (const [name, output] of [['default', normal], ['monochrome', monochrome]]) {
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
                        if (name === 'monochrome') {
                            const colors = await page.evaluate(scopes => {
                                const canvas = document.createElement('canvas');
                                canvas.width = canvas.height = 1;
                                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                return scopes.flatMap(([selector, roles]) => {
                                    let node = document.querySelector(selector);
                                    const fixture = !node;
                                    if (fixture) {
                                        node = document.createElement('span');
                                        node.className = selector.slice(1);
                                        document.body.append(node);
                                    }
                                    const style = getComputedStyle(node);
                                    const values = roles.map(role => {
                                        const value = style.getPropertyValue(role).trim();
                                        if (!value || !CSS.supports('color', value)) throw new Error(`Invalid color role ${selector} ${role}: ${value}`);
                                        ctx.clearRect(0, 0, 1, 1);
                                        ctx.fillStyle = value;
                                        ctx.fillRect(0, 0, 1, 1);
                                        return { selector, role, rgba: [...ctx.getImageData(0, 0, 1, 1).data] };
                                    });
                                    if (fixture) node.remove();
                                    return values;
                                });
                            }, [...scopes].map(([selector, roles]) => [selector, [...roles]]));
                            for (const { selector, role, rgba: [r, g, b] } of colors) {
                                assert(Math.max(r, g, b) - Math.min(r, g, b) <= 1, `${engine.name()} ${mode}: ${selector} ${role} must be neutral.`);
                            }
                        }
                        await page.screenshot({ path: path.join(work, `${engine.name()}-${name}-${mode}.png`), animations: 'disabled' });
                    }
                    console.log(`[PASS] ${engine.name()}: ${name} light/dark palette styles and contrast`);
                } finally { try { if (page) await page.close(); } finally { await server.stop(); } }
            }
        } finally { await browser.close(); }
    }

    console.log(`Palette configuration, asset overrides, and browser checks passed.`);
} finally {
    fs.rmSync(work,{recursive:true,force:true});
}
