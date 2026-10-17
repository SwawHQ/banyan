// Compile the consuming site's real content; fixtures use a temporary directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {toolExecutable} from '../../.agents/skills/swaw-banyan/tasks/_shared/toolchain/operations.mjs';
import { verifyCspOutput } from '../../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {fixtureEnvironment} from '../_shared/hugo.mjs';

const siteRoot = process.cwd(), temporaryRoot = fs.realpathSync(os.tmpdir());
const work = fs.mkdtempSync(path.join(temporaryRoot, 'banyan-prefetch-build-'));

try {
    const hugo = toolExecutable('hugo'), env = fixtureEnvironment(work);
    const rel = file => path.relative(siteRoot, file).replaceAll('\\', '/');
    const read = file => fs.readFileSync(file, 'utf8');
    const enabledConfig = [
        '[prefetch]', 'enabled = true', 'default = "off"',
        '[prefetch.icons.folder]', 'root = "off"', 'tail = "moderate"',
        '"tail-1" = "off"', 'all = "conservative"',
        '[prefetch.prerender]', 'default = "off"',
        '[prefetch.prerender.icons.folder]', 'root = "immediate"', 'tail = "off"', 'all = "conservative"'
    ].join('\n');

    function build(name, policy, output = path.join(work, name), expectedError = '', config = '') {
        const configFile = path.join(work, name + '.toml'), data = path.join(work, name + '-data');
        fs.mkdirSync(data,{recursive:true});
        fs.writeFileSync(path.join(data,'delivery.toml'),policy);
        fs.writeFileSync(configFile,config+'\n[[module.mounts]]\nsource = '+JSON.stringify(data.replaceAll('\\','/'))+
            '\ntarget = "data"\n[[module.mounts]]\nsource = "data"\ntarget = "data"\n');
        const result = spawnSync(hugo, ['--noBuildLock',
            '--config', 'hugo.toml,' + rel(configFile), '--minify',
            '--cleanDestinationDir', '--destination', rel(output)
        ], {cwd:siteRoot, env, encoding:'utf8', timeout:30000, maxBuffer:8 * 1024 * 1024});
        const log = (result.stdout || '') + (result.stderr || '');
        assert.ifError(result.error);
        if (expectedError) {
            assert.notEqual(result.status, 0, name + ' must fail');
            assert.ok(log.includes(expectedError), log);
        } else {
            assert.equal(result.status, 0, log);
            assert.doesNotMatch(log,/\bWARN\b/);
        }
        return output;
    }
    function routes(output) {
        return JSON.parse(read(path.join(output, 'edgeone.json'))).headers;
    }
    function script(html, id) {
        return html.match(new RegExp('<script\\b[^>]*id=["\']?'+id+'["\']?[^>]*>([\\s\\S]*?)<\\/script>'))?.[1];
    }
    function page(output, prefix = '', pathname = '') {
        return read(path.join(output,prefix,pathname,'index.html'));
    }
    function verifyNoExternalRules(output) {
        assert.ok(!routes(output).some(route => route.headers.some(header => header.key.toLowerCase() === 'speculation-rules')));
        assert.doesNotMatch(read(path.join(output,'_headers')),/\bSpeculation-Rules:/);
        assert.ok(!routes(output).some(route => route.source.includes('/site/speculation-rules/')));
        for(const directory of ['site/speculation-rules','speculation-rules','__speculation-rules-manifests'])
            assert.equal(fs.existsSync(path.join(output,directory)),false,'No external rules or intermediate manifests');
    }
    function verifyNoEngine(html) {
        for(const id of ['site-prefetch-data','site-prefetch-rules','site-speculation-rules','site-prefetch-runtime-meta'])
            assert.equal(script(html,id),undefined,'Disabled standard pages must not publish '+id);
        assert.ok(!html.includes('/js/prefetch.runtime.bundle.'),'Disabled standard pages must not load the engine');
    }
    function verifyNative(output, expectedEnabled) {
        verifyNoExternalRules(output);
        let sharedBody;
        const csp=routes(output).find(route=>route.source==='/*').headers.find(header=>header.key==='Content-Security-Policy').value;
        assert.ok(!csp.includes("'unsafe-inline'"));
        for(const prefix of ['','zh','zh-tw']) {
            const regular=page(output,prefix),debug=prefix?null:page(output,prefix,'prefetchdebug');
            assert.doesNotMatch(regular,/\bdata-prefetch-debug(?:\s|=|>)/);
            if(debug)assert.match(debug,/\bdata-prefetch-debug(?:\s|=|>)/);
            if(!expectedEnabled)verifyNoEngine(regular);
            for(const html of [...(expectedEnabled?[regular]:[]),...(debug?[debug]:[])]) {
                const body=script(html,'site-speculation-rules'),payload=JSON.parse(script(html,'site-prefetch-data'));
                assert.equal(typeof body,'string');
                assert.match(html,/<script\b[^>]*type=["']?speculationrules["']?[^>]*>/);
                assert.equal(payload.enabled,expectedEnabled);
                assert.deepEqual(Object.keys(payload).sort(),['enabled','modes','prerender','sw']);
                assert.deepEqual(payload.sw,{enabled:false,url:'/sw.js',scope:'/'});
                assert.ok(html.includes('/js/prefetch.runtime.bundle.'),'Configured and diagnostic pages load one full engine');
                assert.equal(script(html,'site-prefetch-runtime-meta'),undefined);
                if(sharedBody===undefined)sharedBody=body;else assert.equal(body,sharedBody,'Native rule bytes must agree across pages and languages');
                const hash="'sha256-"+createHash('sha256').update(body).digest('base64')+"'";
                assert.ok(csp.includes(hash),'CSP must allow the exact final native body, including disabled diagnostics');
                const selectors=JSON.parse(script(html,'site-prefetch-rules'));
                for(const [kind,rules] of Object.entries(JSON.parse(body))) {
                    for(const rule of rules) {
                        const id=selectors[kind].find(target=>target.selector===rule.where.and[0].selector_matches)?.id;
                        assert.ok(id,'Native and custom rules share their selector');
                        if(kind==='prefetch')assert.notEqual(payload.modes[id],'off');
                        assert.equal(rule.source,'document');
                        assert.equal(rule.eagerness,(kind==='prerender'?payload.prerender:payload.modes)[id]);
                        assert.deepEqual(rule.where.and.slice(1),[
                            {selector_matches:'html[data-prefetch-native-ready] a'},
                            {href_matches:['/','/*/','/*.html','/*.htm'],relative_to:'document'},
                            {not:{href_matches:'#*',relative_to:'document'}}
                        ]);
                    }
                }
            }
            verifyNoEngine(page(output,prefix,'offline'));
        }
        verifyCspOutput(output);
        return sharedBody;
    }

    verifyNative(build('off','[prefetch]\nenabled = false\n'),false);
    const enabled=build('enabled',enabledConfig),body=verifyNative(enabled,true),rules=JSON.parse(body);
    assert.equal(rules.prefetch.length,2);
    const selectors=JSON.parse(script(page(enabled),'site-prefetch-rules'));
    assert.deepEqual(rules.prefetch.map(rule=>rule.where.and[0].selector_matches),
        selectors.prefetch.filter(target=>['folder/tail','folder/all'].includes(target.id)).map(target=>target.selector));
    assert.ok(rules.prerender.every(rule=>selectors.prerender.some(target=>target.selector===rule.where.and[0].selector_matches)));
    assert.equal(verifyNative(build('repeat',enabledConfig),true),body,'Identical rules keep identical CSP body bytes');
    assert.notEqual(verifyNative(build('changed',enabledConfig.replace('tail = "moderate"','tail = "eager"')),true),body);
    const immediate=build('immediate',enabledConfig.replace('tail = "moderate"','tail = "immediate"'));
    assert.equal(JSON.parse(verifyNative(immediate,true)).prefetch[0].eagerness,'immediate');
    const allOff=enabledConfig.replace('tail = "moderate"','tail = "off"').replaceAll('all = "conservative"','all = "off"');
    assert.equal(verifyNative(build('empty',allOff),true),'{}','All off rules leave no native action');
    assert.equal(verifyNative(build('disabled-after-enabled',enabledConfig.replace('enabled = true','enabled = false'),enabled),false),body,
        'Disabled diagnostics still receive the same rules for forced testing');

    const offsets=build('offsets',[
        '[prefetch]','enabled = true','default = "off"',
        '[prefetch.icons.folder]','all = "conservative"','root = "off"','tail = "eager"',
        '"tail-1" = "moderate"','"tail-2" = "off"','"root+1" = "immediate"','"root+12" = "moderate"',
        '[prefetch.prerender.icons.folder]','tail = "off"','"tail-1" = "eager"','"root+1" = "moderate"'
    ].join('\n'));
    const payload=JSON.parse(script(page(offsets),'site-prefetch-data'));
    assert.equal(payload.modes['folder/root+1'],'immediate');
    assert.equal(payload.modes['folder/tail-2'],'off');
    assert.equal(payload.prerender['folder/tail-1'],'eager');
    const offsetTargets=JSON.parse(script(page(offsets),'site-prefetch-rules'));
    assert.deepEqual(offsetTargets.prefetch.map(target=>target.id),[
        'folder/root','folder/tail','folder/tail-1','folder/tail-2','folder/root+1','folder/root+12','folder/all','default'
    ]);
    assert.ok(!offsetTargets.prefetch.find(target=>target.id==='folder/root+1').selector.includes('nth-last-child(n+'));
    verifyNative(offsets,true);

    const subpath=build('subpath',enabledConfig,undefined,'','baseURL = "https://example.test/base/"\n');
    assert.deepEqual(JSON.parse(script(page(subpath),'site-prefetch-data')).sw,{enabled:false,url:'/base/sw.js',scope:'/base/'});

    const invalid=[
        ['legacy-runtime','[prefetch_runtime]\nmode = "off"','unknown field "prefetch_runtime"'],
        ['legacy-native','[speculation_rules]\nmode = "off"','unknown field "speculation_rules"'],
        ['enabled-type','[prefetch]\nenabled = "false"','prefetch.enabled must be a boolean'],
        ['mode','[prefetch]\nenabled = false\ndefault = "link_xf"','must use off/conservative/moderate/eager/immediate'],
        ['gate','[prefetch]\nenabled = false\ndefault = "sw_xf_g"','must use off/conservative/moderate/eager/immediate'],
        ['empty-mode','[prefetch]\nenabled = false\ndefault = ""','must use off/conservative/moderate/eager/immediate'],
        ['mode-type','[prefetch]\nenabled = false\ndefault = false','must use off/conservative/moderate/eager/immediate'],
        ['legacy-env','[prefetch.env.TT]\ndefault = "eager"','unknown field "env"'],
        ['legacy-ref','[prefetch]\nref = "TT"','unknown field "ref"'],
        ['icon','[prefetch.icons.undefined-icon]\nall = "eager"','must name an SVG'],
        ['scope','[prefetch.icons.folder]\ndescendants = "eager"','unknown scope'],
        ['old-current','[prefetch.icons.folder]\ncurrent = "eager"','unknown scope'],
        ['old-parent','[prefetch.icons.folder]\nparent_2 = "eager"','unknown scope'],
        ['old-ancestors','[prefetch.icons.folder]\nancestors = "eager"','unknown scope'],
        ['root-zero','[prefetch.icons.folder]\n"root+0" = "eager"','unknown scope'],
        ['tail-zero','[prefetch.icons.folder]\n"tail-0" = "eager"','unknown scope'],
        ['offset-leading-zero','[prefetch.icons.folder]\n"tail-01" = "eager"','unknown scope'],
        ['root-negative','[prefetch.icons.folder]\n"root-1" = "eager"','unknown scope'],
        ['icons-type','[prefetch]\nicons = []','icons must be a table'],
        ['prerender-type','[prefetch]\nprerender = false','prerender must be a table'],
        ['prerender-field','[prefetch.prerender]\nenabled = true','unknown field "enabled"'],
        ['prerender-mode','[prefetch.prerender]\ndefault = "prerender_eager"','must use off/conservative/moderate/eager/immediate']
    ];
    for(const [name,policy,error] of invalid)build('invalid-'+name,policy,undefined,error);
    for(const parameter of ['prefetch','speculation_rules'])
        build('language-'+parameter,enabledConfig,undefined,'params.'+parameter+' is not supported',
            '\n[languages.zh.params.'+parameter+']\nenabled = false\n');
    console.log('Unified prefetch build contracts passed: inline rules, exact CSP hashes, scopes, strict disabled validation and diagnostic/offline boundaries.');
} finally {
    assert.equal(path.dirname(fs.realpathSync(work)),temporaryRoot);
    fs.rmSync(work,{recursive:true,force:true});
}
