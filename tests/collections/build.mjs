// Exercise the real site with a temporary content overlay; never edit its content.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {loadChromium} from '../../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {toolExecutable} from '../../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import { verifyCspOutput } from '../../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {createStaticSiteServer} from '../../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {gotoAndWait} from '../../.agents/skills/swaw-banyan/tasks/check/browser/_shared/page.mjs';
import {waitForBrowse} from '../../.agents/skills/swaw-banyan/tasks/check/browser/_shared/viewport.mjs';
import {extractBlocks} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {readBreadcrumbData} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/breadcrumb.mjs';
import {decodeHtmlAttribute,extractStartTags,extractTagAttribute} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

import {fixtureEnvironment,fixtureSiteMounts,directoryPage,fixtureContentDirectory} from '../_shared/hugo.mjs';
import {collectionPayload} from '../_shared/navigation.mjs';

const root = process.cwd();
const temporaryRoot = path.join(os.tmpdir(), 'swaw/banyan/collections');
fs.mkdirSync(temporaryRoot, {recursive:true});
const work = fs.mkdtempSync(path.join(temporaryRoot, 'contract-'));

try {
    const rel = p => path.relative(root, p).replaceAll('\\', '/');
    const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
    const overlay = path.join(work, 'content');
    fixtureContentDirectory(overlay);
    const langs = ['', '.zh', '.zh-tw'];
    const prefixes = ['', '/zh', '/zh-tw'];
    // A self-contained 1px WebP keeps image contracts independent of site/legal assets.
    const imageBytes = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
    const imageHash = createHash('sha256').update(imageBytes).digest('hex');
    const ownImage = {image: `/media/content/d/contract-no-offer/badge.${imageHash}.webp`};
    const inheritedImage = {image: `/media/content/d/contract-image/badge.${imageHash}.webp`, monochrome: true};
    const logoBytes = fs.readFileSync(path.join(root, 'assets/site/favicon.link.svg'));
    const logoHash = createHash('sha256').update(logoBytes).digest('hex');
    const assetImage = {image: `/site/favicon.link.${logoHash}.svg`};
    const monochromeAsset = {...assetImage, monochrome: true};
    const cases = [
        ['priced', 'lastmod: 2026-08-01\nparams:\n  icon: appearance-dark\n  offer: {amount: 25, currency: "$", value: "Paid and free are opaque labels"}'],
        ['missing', 'lastmod: 2026-08-02\nparams:\n  offer: {value: "Value without a price"}'],
        ['zero', 'params:\n  icon: {text: "<b>EN</b>"}\n  offer: {amount: 0, currency: "$"}'],
        ['no-offer', 'params:\n  icon: {image: "badge.webp"}'],
        ['unclassified', 'params:\n  icon: {image: "site/favicon.link.svg", monochrome: true}\n  offer: {amount: 99, currency: "$", value: "Not a product"}'],
        ['ref-branches', ''],
        ['empty', ''],
        ['blank', '']
    ];
    for (const lang of langs) {
        write(path.join(overlay, `d/contract-inherit/_index${lang}.md`), '---\ntitle: Inherited list fixture\n---\n');
        write(path.join(overlay, `d/contract-inherit/note${lang}.md`), '---\ntitle: Inherited list article\nurl: p/contract-inherited-list/\n---\nSynthetic article.\n');
        for (const [name, fields] of [['default', ''], ['local', 'build: {list: local}'], ['hidden', 'build: {list: never}'], ['link', 'build: {render: link}'], ['never', 'build: {render: never}']]) {
            write(path.join(overlay, `contract-nav-${name}/index${lang}.md`), `---\ntitle: Navigation ${name}\nurl: contract-nav-${name}/\nlayout: page-article-norss\n${fields}\n---\nNavigation fixture.\n`);
        }
        write(path.join(overlay, `products/contract-empty/_index${lang}.md`), '---\ntitle: Contract empty category\nparams:\n  icon: rss\n---\n');
        write(path.join(overlay, `products/contract-dates/_index${lang}.md`), '---\ntitle: Contract dates\nlayout: page-collection-directory\n---\n');
        write(path.join(overlay, `products/contract-name/_index${lang}.md`), '---\ntitle: Names only\nlayout: page-collection-directory-name-only\n---\n');
        write(path.join(overlay, `contract-name-reference/_index${lang}.md`), '---\ntitle: Referenced names\nlayout: page-collection-directory-name-only\nparams:\n  slots: [ breadcrumb ]\n---\n');
        for (const list of ['local', 'never']) {
            write(path.join(overlay, `contract-all-${list}/_index${lang}.md`), `---\ntitle: ${list} articles\nlayout: page-collection-directory-all\nbuild: { list: ${list} }\nparams:\n  aggregate: /d\n---\n`);
        }
        for (const term of [
            'contract-dates',
            'contract-dates/child',
            'contract-tree',
            'contract-tree/shallow',
            'contract-tree/deep',
            'contract-tree/deep/leaf'
        ]) {
            write(path.join(overlay, `topics/${term}/_index${lang}.md`), `---\ntitle: ${term}\n---\n`);
        }
        write(path.join(overlay, `topics/unfiled/_index${lang}.md`), '---\ntitle: Unfiled\n---\n');
        write(path.join(overlay, `products/paid/_index${lang}.md`), '---\ntitle: Paid fixture\nparams:\n  list_icon_file: appearance-light\n---\n');
        for (const [name, fields] of cases) write(path.join(overlay, `d/contract-${name}/index${lang}.md`),
            `---\ntitle: "Contract ${name}"\nurl: p/contract-${name}/\ndate: 2026-01-01\n${fields}\n---\nArticle body stays an article.\n`);
        write(path.join(overlay, `d/contract-override/_index${lang}.md`), '---\ntitle: Override\nlayout: page-collection-directory\nparams:\n  icon: info\n  list_icon_folder: rss\n  list_icon_file: appearance-auto\ncascade:\n  - target: {kind: section}\n    layout: page-collection-directory\n---\n');
        write(path.join(overlay, `d/contract-override/child/_index${lang}.md`), '---\ntitle: Child inherits override\nparams:\n  list_icon_file: theme\n---\n');
        write(path.join(overlay, `d/contract-override/child/item${lang}.md`), '---\ntitle: Child item\nurl: p/contract-child/\n---\nChild.\n');
        write(path.join(overlay, `d/contract-override/direct${lang}.md`), '---\ntitle: Direct item\nurl: p/contract-direct/\nlastmod: 2026-08-03\n---\nDirect.\n');
        write(path.join(overlay, `d/contract-override/child/nested/_index${lang}.md`), '---\ntitle: Nested\nparams:\n  list_icon_file: ""\n---\n');
        write(path.join(overlay, `d/contract-override/child/nested/item${lang}.md`), '---\ntitle: Nested item\nurl: p/contract-nested/\n---\nNested.\n');
        write(path.join(overlay, `d/contract-text/_index${lang}.md`), '---\ntitle: Text icons\nparams:\n  icon: { text: "©" }\n  list_icon_folder: { text: "Dir" }\n  list_icon_file: { text: "EN" }\n---\n');
        write(path.join(overlay, `d/contract-text/child/_index${lang}.md`), '---\ntitle: Child text icons\nparams:\n  list_icon_file: product\n---\n');
        write(path.join(overlay, `d/contract-text/item${lang}.md`), '---\ntitle: Text item\nurl: p/contract-text/\n---\nText.\n');
        write(path.join(overlay, `d/contract-text/child/item${lang}.md`), '---\ntitle: Text child\nurl: p/contract-text-child/\n---\nText child.\n');
        write(path.join(overlay, `d/contract-image/_index${lang}.md`), '---\ntitle: Image icons\nparams:\n  list_icon_file: { image: "badge.webp", monochrome: true }\n  list_icon_folder: { image: "site/favicon.link.svg", monochrome: false }\n---\n');
        write(path.join(overlay, `d/contract-image/child/_index${lang}.md`), '---\ntitle: Inherited image\n---\n');
        write(path.join(overlay, `d/contract-image/child/item${lang}.md`), '---\ntitle: Inherited image article\nurl: p/contract-image-child/\n---\nImage.\n');
    }
    write(path.join(overlay, 'd/contract-no-offer/badge.webp'), imageBytes);
    write(path.join(overlay, 'd/contract-image/badge.webp'), imageBytes);
    const config = path.join(work, 'overlay.toml');
    write(config, `[taxonomies]\n[[module.mounts]]\nsource = "${rel(overlay)}"\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`+fixtureSiteMounts);
    for(const lang of langs) {
        write(path.join(overlay, `topics/_index${lang}.md`),directoryPage('Topics'));
        write(path.join(overlay, `products/_index${lang}.md`),directoryPage('Products','','list_icon_file: product')
            .replace('    layout: page-collection-directory','    layout: page-collection-products'));
        write(path.join(overlay, `products/special-products/_index${lang}.md`),'---\ntitle: Special Products\n---\n');
        write(path.join(overlay, `products/price-band/_index${lang}.md`),'---\ntitle: "$5~$50"\n---\n');
        write(path.join(overlay, `products/free/_index${lang}.md`),'---\ntitle: Free fixture\n---\n');
        write(path.join(overlay, `products-all/_index${lang}.md`),'---\ntitle: All products\nlayout: page-collection-products-all\nparams:\n  list_icon_file: product\n  aggregate: /products\n  slots: [ breadcrumb ]\n---\n');
    }
    const memberships={
        'topics/contract-dates':['priced'], 'topics/contract-dates/child':['missing'],
        'topics/contract-tree':['ref-branches'], 'topics/contract-tree/shallow':['ref-branches'],
        'topics/contract-tree/deep/leaf':['ref-branches'], 'topics/unfiled':['unclassified'],
        'products/free':['priced','missing','zero','no-offer'], 'products/paid':['priced','missing'],
        'products/special-products':['priced','missing'], 'products/price-band':['priced'],
        'products/contract-dates':['priced','missing'], 'products/contract-name':['priced','missing'],
        'contract-name-reference':['priced','missing','zero','no-offer']
    };
    for(const [directory,articles] of Object.entries(memberships))
        write(path.join(overlay,directory,'_map.toml'),'refs = '+JSON.stringify(articles.map(name=>'/d/contract-'+name))+'\n');
    const hugo = toolExecutable('hugo');
    function build(view) {
        for (const lang of langs) {
            const layouts={directory:'page-collection-directory',all:'page-collection-directory-all',products:'page-collection-products',name:'page-collection-directory-name-only'};
            const source = directoryPage('Content','','icon: info'+(view==='all'?'\naggregate: /d':''))
                .replace('layout: page-collection-directory\n','layout: '+layouts[view]+'\n');
            write(path.join(overlay, `d/_index${lang}.md`), view==='all'?source:source.replace('    layout: page-collection-directory','    layout: '+layouts[view]));
        }
        const output = path.join(work, view);
        const result = spawnSync(hugo, ['--noBuildLock','--config', `hugo.toml,${rel(config)}`, '--minify', '--destination', rel(output)],
            { cwd: root, env: fixtureEnvironment(work), encoding: 'utf8', windowsHide: true });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        verifyCspOutput(output);
        assert.equal(fs.existsSync(path.join(output, '__fragments')), false, 'collection rows stay in HTML instead of duplicate fragment output');
        return output;
    }

    const payloadCache = new Map();

    function readSources(output, lang, logical) {
        const languageDir = lang === 'en' ? '' : lang;
        const logicalParts = decodeURI(logical).split('/').filter(Boolean);
        const htmlPath = path.join(output, languageDir, ...logicalParts, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        const data = readBreadcrumbData(html, {directory:output});
        assert.equal(data.error, '', `${logical} publishes valid breadcrumb data`);
        return data.sources;
    }

    function payload(output, lang, logical) {
        const cacheKey = `${output}|${lang}|${logical}`;
        if (payloadCache.has(cacheKey)) return payloadCache.get(cacheKey);

        const logicalPath = `/${logical.replace(/^\/+|\/+$/g, '')}/`;
        const data = collectionPayload(output,logicalPath,prefixes[['en','zh','zh-tw'].indexOf(lang)]+logicalPath);
        assert(data && typeof data === 'object', `${logical} publishes its collection rows as shared JSON`);
        assert([...data.f, ...Object.keys(data.c || {})].every(field => !field.endsWith('_text') && !['size_unit', 'count_unit'].includes(field)),
            `${logical} navigation payload omits display-only fields`);
        assert(!data.f.includes('key') && !data.f.includes('sort_group'),
            `${logical} navigation payload omits URL duplicates and derived groups`);
        const rows = [];
        for (let offset = 0; offset < data.rv.length; offset += data.f.length) {
            rows.push({ ...data.c, ...Object.fromEntries(data.f.map((key, i) => [key, data.rv[offset + i]])) });
        }
        const result = { ...data, rows };
        payloadCache.set(cacheKey, result);
        return result;
    }
    const displayedRowsCache = new Map();
    function displayedRows(output, lang, logical) {
        const cacheKey = `${output}|${lang}|${logical}`;
        if (displayedRowsCache.has(cacheKey)) return displayedRowsCache.get(cacheKey);
        const html = fs.readFileSync(path.join(output, lang === 'en' ? '' : lang, ...decodeURI(logical).split('/').filter(Boolean), 'index.html'), 'utf8');
        const main = extractBlocks(html, 'main')[0];
        assert(main, `${logical} renders its main list`);
        const rows = extractBlocks(main.inner, 'div', tag => /\bdata-list-item(?:\s|=|>)/.test(tag)).map(block => {
            const link = extractStartTags(block.inner, 'a').find(tag => /\bdata-list-entry(?:\s|=|>)/.test(tag));
            assert(link, `${logical} list row links to its entry`);
            const fields = Object.fromEntries(extractBlocks(block.inner, 'span', tag => /\bdata-item-field(?:\s|=|>)/.test(tag))
                .map(field => [extractTagAttribute(field.open, 'data-item-field'), decodeHtmlAttribute(field.inner.replace(/<[^>]*>/g, '')).trim()]));
            return {href: new URL(extractTagAttribute(link, 'href'), 'https://example.test').pathname, fields};
        });
        displayedRowsCache.set(cacheKey, rows);
        return rows;
    }
    const builds = {};
    const directoryMembers = new Map();
    for (const view of ['directory', 'all', 'products', 'name']) {
        const output = builds[view] = build(view);
        for (const [index, lang] of ['en', 'zh', 'zh-tw'].entries()) {
            const current = payload(output, lang, 'd');
            const hrefs = current.rows.map(row => row.href).sort();
            if (view === 'directory') directoryMembers.set(lang, hrefs);
            else if(view==='all')assert.deepEqual(hrefs,payload(output,lang,'all').rows.map(row=>row.href).sort(),'The -all preset reads the same recursive members as its aggregate.');
            else assert.deepEqual(hrefs, directoryMembers.get(lang), `${view} must not filter native directory members`);
            assert.equal(current.sv, view === 'directory' ? 'section' : view);
            const aggregate = payload(output, lang, 'all');
            assert(aggregate.rows.every(row => !('sort_path' in row) && !('path_text' in row) && !('path_href' in row)), 'aggregate rows omit the removed Path column');
            assert.equal(payload(output, lang, 'd/contract-inherit').sv, view==='all'?'section':current.sv, 'undeclared sections inherit the native cascade layout');
            assert.equal(payload(output, lang, 'd/contract-override').sv, 'section');
            assert.equal(payload(output, lang, 'd/contract-override/child').sv, 'section', 'nearest cascade wins');
            for (const list of ['local', 'never']) {
                const logicalPath = `/contract-all-${list}/`;
                const html = fs.readFileSync(path.join(output, prefixes[index].slice(1), logicalPath, 'index.html'), 'utf8');
                const body = extractStartTags(html, 'body')[0];
                assert.equal(extractTagAttribute(body, 'data-collection-path'),logicalPath,`build.list: ${list} must publish its main collection path`);
                const main = extractBlocks(html, 'main')[0];
                assert.ok(main, `build.list: ${list} must render its main column`);
                const rows = extractStartTags(main.inner, 'a').filter(tag => /\bdata-list-entry(?:\s|=|>)/.test(tag))
                    .map(tag => new URL(extractTagAttribute(tag, 'href'), 'https://example.test').pathname);
                assert.deepEqual(rows, payload(output, lang, 'all').rows.map(row => row.href),
                    `build.list: ${list} must retain every aggregate row in SSR`);
            }
            const assertUpdated = (list, href, text, key) => {
                const row = payload(output, lang, list).rows.find(row => row.href === `${prefixes[index]}${href}`);
                assert(row, `${list} contains ${href}`);
                const displayed = displayedRows(output, lang, list).find(row => row.href === `${prefixes[index]}${href}`);
                assert.equal(displayed?.fields.date, text, `${list}: display uses Lastmod`);
                assert.equal(row.sort_date, key, `${list}: sorting uses the displayed time`);
            };
            for (const list of ['all', 'products/contract-dates', ...(['products', 'name'].includes(view) ? [] : ['d'])]) {
                assertUpdated(list, '/p/contract-priced/', '2026-08-01', '20260801000000');
                assertUpdated(list, '/p/contract-missing/', '2026-08-02', '20260802000000');
                const dated = payload(output, lang, list).rows.filter(row => /\/p\/contract-(priced|missing)\//.test(row.href));
                assert.deepEqual(dated.map(row => row.sort_date), ['20260802000000', '20260801000000'], 'default order uses Lastmod, not publication date or name');
                const displayed = displayedRows(output, lang, list).filter(row => /\/p\/contract-(priced|missing)\//.test(row.href));
                assert.deepEqual(displayed.map(row => row.fields.date), ['2026-08-02', '2026-08-01'], 'SSR date order agrees with the navigation order');
            }
            assertUpdated('all', '/p/contract-no-offer/', '2026-01-01', '20260101000000'); // Explicit date fallback when lastmod is absent.
            assertUpdated('all', '/p/contract-direct/', '2026-08-03', '20260803000000'); // No publication date.
            assertUpdated('all', '/p/contract-child/', '—', ''); // No usable time at all.
            if (view==='directory') assertUpdated('d', '/d/contract-override/', '2026-08-03', '20260803000000');
            assertUpdated('products', '/products/contract-dates/', '2026-08-02', '20260802000000');
            assertUpdated('products', '/products/contract-empty/', '—', '');
            assertUpdated('topics', '/topics/contract-dates/', '2026-08-02', '20260802000000');
            assertUpdated('topics/contract-dates', '/topics/contract-dates/child/', '2026-08-02', '20260802000000');
            assertUpdated('topics/contract-dates', '/p/contract-priced/', '2026-08-01', '20260801000000');
            assertUpdated('topics/contract-dates/child', '/p/contract-missing/', '2026-08-02', '20260802000000');
            const branchHref=`${prefixes[index]}/p/contract-ref-branches/`;
            for(const directory of ['topics/contract-tree','topics/contract-tree/shallow','topics/contract-tree/deep/leaf'])
                assert(payload(output,lang,directory).rows.some(row=>row.href===branchHref),'Each explicit directory reference is visible.');
            const branchHtml=fs.readFileSync(path.join(output,prefixes[index].slice(1),'p/contract-ref-branches/index.html'),'utf8');
            const referenceRows=(branchHtml.match(/<nav\b[^>]*data-directory-reference=[\s\S]*?<\/nav>/g)||[]);
            assert.equal(referenceRows.length,3,'Every explicit reference has its own metadata row.');
            for(const directory of ['contract-tree','contract-tree/shallow','contract-tree/deep/leaf'])
                assert(referenceRows.some(row=>row.includes(`${prefixes[index]}/topics/${directory}/`)),'Metadata retains each reference path.');
            const ancestor=payload(output,lang,'topics').rows.find(row=>row.href===`${prefixes[index]}/topics/contract-tree/`);
            assert.equal(ancestor.sort_count,'1','An ancestor counts one canonical article across overlapping references.');
            assert.equal(displayedRows(output,lang,'topics').find(row=>row.href===ancestor.href)?.fields.count,'1','The ancestor displays its unique article count.');
            const unfiled=payload(output,lang,'topics/unfiled').rows.find(row=>row.href===`${prefixes[index]}/p/contract-unclassified/`);
            assert(unfiled,'An explicit directory reference lists an otherwise unfiled article.');
            assert.equal('key' in unfiled,false,'Referenced articles use href without a duplicate serialized key.');
            const iconFor = (list, href) => payload(output, lang, list).rows.find(row => row.href === `${prefixes[index]}${href}`)?.icon;
            for (const list of ['d', 'all', 'products/free', 'products-all']) {
                assert.deepEqual(iconFor(list, '/p/contract-no-offer/'), ownImage, 'own image resolves against its article bundle in every list');
            }
            assert.deepEqual(iconFor('d/contract-image', '/d/contract-image/child/'), assetImage, 'directory defaults support global assets');
            for (const list of ['d', 'all']) {
                assert.deepEqual(iconFor(list, '/p/contract-unclassified/'), monochromeAsset, 'own monochrome image reuses a global asset without changing its URL');
            }
            assert.deepEqual(fs.readFileSync(path.join(output, assetImage.image)), logoBytes);
            assert.deepEqual(fs.readdirSync(path.join(output, 'site')).filter(name => name.startsWith('favicon.')), [`favicon.link.${logoHash}.svg`], 'favicon and content icons publish one shared resource');
            assert.deepEqual(iconFor('d/contract-image/child', '/p/contract-image-child/'), inheritedImage, 'inherited image keeps its declaring directory, not the child bundle');
            assert.deepEqual(fs.readFileSync(path.join(output, ownImage.image)), imageBytes, 'published hash matches the original bytes');
            assert.equal(fs.existsSync(path.join(output, 'd/contract-no-offer/badge.webp')), false, 'icon source is not also published at an unhashed URL');
            if(view!=='all')assert.deepEqual(iconFor('d', '/d/contract-text/'), {text: '©'});
            assert.deepEqual(iconFor('d/contract-text', '/d/contract-text/child/'), {text: 'Dir'});
            assert.deepEqual(iconFor('d/contract-text', '/p/contract-text/'), {text: 'EN'});
            assert.equal(iconFor('d/contract-text/child', '/p/contract-text-child/'), 'product', 'SVG overrides inherited text atomically');
            for (const list of ['d', 'all', 'products/free', 'products-all']) {
                assert.deepEqual(iconFor(list, '/p/contract-zero/'), {text: '<b>EN</b>'}, 'text icon case and literal markup survive the payload');
            }
            assert.equal(iconFor('d', '/p/contract-empty/'), 'file', 'a parent icon is not inherited by its articles');
            if(view!=='all')assert.equal(iconFor('d', '/d/contract-override/'), 'info', 'a directory may declare its own icon');
            assert.equal(iconFor('d/contract-override', '/d/contract-override/child/'), 'rss');
            assert.equal(iconFor('d/contract-override', '/p/contract-direct/'), 'appearance-auto');
            assert.equal(iconFor('d/contract-override/child', '/d/contract-override/child/nested/'), 'rss', 'folder default still inherits after a file-only override');
            assert.equal(iconFor('d/contract-override/child', '/p/contract-child/'), 'theme');
            assert.equal(iconFor('d/contract-override/child/nested', '/p/contract-nested/'), 'theme', 'blank declarations inherit');
            assert.equal(iconFor('products', '/products/contract-empty/'), 'rss', 'Directory own icon wins over the folder default');
            assert.equal(iconFor('products/free', '/p/contract-missing/'), 'product', 'Directory inherits its parent file default');
            assert.equal(iconFor('products/paid', '/p/contract-missing/'), 'appearance-light', 'A directory can override its file default');
            assert.equal(iconFor('products-all', '/p/contract-missing/'), 'product', 'aggregate uses its own default');
            assert.equal(iconFor('all', '/p/contract-direct/'), 'file', 'aggregate does not inherit its target defaults');
            for (const list of ['d', 'all', 'products/free', 'products/paid', 'products-all']) {
                assert.equal(iconFor(list, '/p/contract-priced/'), 'appearance-dark', `own article icon wins in ${list}`);
            }
            const all = payload(output, lang, 'products-all');
            assert.equal(all.rows.filter(row => /\/p\/contract-/.test(row.href)).length, 4, 'Directory union includes four fixture products, once each');
            assert.equal(new Set(all.rows.map(row => row.href)).size, all.rows.length);
            assert(!all.rows.some(row => /\/p\/contract-(unclassified|empty|blank)\//.test(row.href)));
            const free = payload(output, lang, 'products/free');
            assert.equal(free.sv, 'products');
            assert.equal(free.rows.filter(row => /\/p\/contract-/.test(row.href)).length, 4);
            const displayedFree = displayedRows(output, lang, 'products/free');
            assert.equal(displayedFree.find(row => row.href.includes('contract-priced')).fields.price, '$25', 'category labels do not validate prices');
            assert.equal(displayedFree.find(row => row.href.includes('contract-missing')).fields.price, '—');
            assert.equal(displayedFree.find(row => row.href.includes('contract-priced')).fields.value, 'Paid and free are opaque labels');
            assert.equal(displayedFree.find(row => row.href.includes('contract-missing')).fields.value, 'Value without a price');
            assert.equal(free.rows.find(row => row.href.includes('contract-priced')).sort_price, '25');
            assert.equal(free.rows.find(row => row.href.includes('contract-priced')).sort_value, 'Paid and free are opaque labels');
            assert.equal(free.rows.find(row => row.href.includes('contract-zero')).sort_price, '0');
            const categories = payload(output, lang, 'products');
            assert.equal(categories.sv, 'section');
            assert(categories.rows.some(row => row.href === `${prefixes[index]}/products/contract-empty/` && row.sort_count === '0'));
            assert.equal(displayedRows(output,lang,'products').find(row=>row.href===`${prefixes[index]}/products/contract-empty/`)?.fields.count,'0','Empty directories display their zero count.');
            for (const label of ['Special Products', '$5~$50']) {
                const term = categories.rows.find(row => row.text === label);
                assert(term, `Explicit directory ${label}`);
                const logical = term.href.replace(new RegExp(`^${prefixes[index]}/`), '').replace(/\/$/, '');
                assert(payload(output, lang, decodeURI(logical)).rows.length > 0);
            }
            const html = fs.readFileSync(path.join(output, prefixes[index].slice(1), 'p/contract-missing/index.html'), 'utf8');
            assert(!/data-sortable=(?:"true"|true)/.test(html), 'the section cascade keeps article layouts separate');
            for (const list of ['products/contract-name', 'contract-name-reference', ...(view === 'name' ? ['d', 'd/contract-inherit'] : [])]) {
                const names = payload(output, lang, list);
                assert.equal(names.sv, 'name');
                assert.equal(names.ds, 'name-asc');
                assert(names.rows.length > 0);
                assert(names.rows.every(row => !('sort_date' in row) && !('date_text' in row) && !('count_text' in row) && !('price_text' in row)), 'name payloads only contain name and shared navigation fields');
                const ranks = names.rows.map(row => Number(row.sort_name));
                assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'SSR name order agrees with its shipped sort ranks');
            }
        }
        console.log(`PASS collection membership, inheritance and Lastmod dates: ${view}, all three languages`);
    }

    const chromium=loadChromium();
    const browser = await chromium.launch({ headless: true,executablePath:chromium.executablePath() });
    const server = await createStaticSiteServer(builds.directory);
    await server.start();
    const baseUrl = server.getBaseUrl();
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        for (const [index, lang] of ['en', 'zh', 'zh-tw'].entries()) {
            await gotoAndWait(page, `${baseUrl}${prefixes[index]}/products/`);
            const names = await page.locator('.slot-main .item-title').allTextContents();
            assert.deepEqual(names, payload(builds.directory, lang, 'products').rows.map(row => row.text), 'default category order agrees before and after hydration');
            assert.equal(await page.locator(`[data-root-href="${prefixes[index]}/d/"] use`).getAttribute('href'), '#icon-info', 'root navigation honors the same own icon');
            const nav = page.locator('[data-root-href*="/contract-nav-"]');
            assert.deepEqual((await nav.evaluateAll(nodes => nodes.map(node => node.dataset.rootHref))).sort(),
                ['default', 'local'].map(name => `${prefixes[index]}/contract-nav-${name}/`), 'Renderable direct children appear by default; hidden and non-rendered pages stay out.');
            assert.equal(await page.locator(`[data-root-href="${prefixes[index]}/d/contract-override/"]`).count(), 0, 'Nested children do not become root entries.');
            for (const name of ['default', 'local', 'hidden']) {
                const response = await page.request.get(`${baseUrl}${prefixes[index]}/contract-nav-${name}/`);
                assert.equal(response.status(), 200, 'Navigation visibility must not disable page output.');
            }
            for (const name of ['link', 'never'])
                assert.equal(fs.existsSync(path.join(builds.directory, prefixes[index].slice(1), `contract-nav-${name}/index.html`)), false, 'Non-rendered pages have no HTML output.');
        }
        for (const list of ['d', 'all', 'products/contract-dates']) {
            for (const direction of ['asc', 'desc']) {
                await gotoAndWait(page, `${baseUrl}/${list}/#sort=date-${direction}`);
                const links = '.slot-main .item-control[href*="/p/contract-"]';
                const dates = await page.locator(links).evaluateAll(nodes => nodes
                    .filter(node => /\/p\/contract-(priced|missing)\//.test(node.href))
                    .map(node => node.closest('[data-list-item]').querySelector('[data-item-field="date"]').textContent.trim()));
                assert.deepEqual(dates, direction === 'asc' ? ['2026-08-01', '2026-08-02'] : ['2026-08-02', '2026-08-01']);
                assert.match(await page.locator('.slot-main [data-sort-field="date"]').textContent(), /Updated/);
                assert.equal(await page.locator('.slot-main [data-sort-field="date"]').getAttribute('aria-label'),
                    'Sort by Updated '+(direction==='asc'?'descending':'ascending'));
                const ordered = await page.locator(links).evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
                await page.locator(`${links}[href*="/p/contract-missing/#"]`).click();
                await waitForBrowse(page);
                const pathOrder = await page.locator('[data-slot=breadcrumb] .item-control[href*="/p/contract-"]').evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
                assert.deepEqual(pathOrder, ordered, 'Lastmod sort survives entry into the article path column');
            }
        }
        console.log('PASS Lastmod ascending/descending display and article path order');
        for (const direction of ['asc', 'desc']) {
            await gotoAndWait(page, `${baseUrl}/products/free/#sort=price-${direction}`);
            assert.equal(await page.locator('.slot-main [data-sort-field="price"]').getAttribute('aria-label'),
                'Sort by Price '+(direction==='asc'?'descending':'ascending'));
            const ordered = await page.locator('.slot-main .item-list--products .item-control').evaluateAll(links => links.map(link => ({
                href: new URL(link.href).pathname,
                price: link.closest('[data-list-item]').dataset.sortPrice ?? ''
            })));
            assert.equal(ordered.length, payload(builds.directory, 'en', 'products/free').rows.length);
            const firstMissing = ordered.findIndex(row => row.price === '');
            assert(firstMissing >= 0);
            assert(ordered.slice(firstMissing).every(row => row.price === ''), `unpriced last on price-${direction}`);
            const amounts = ordered.slice(0, firstMissing).map(row => Number(row.price));
            assert.deepEqual(amounts, [...amounts].sort((a, b) => direction === 'asc' ? a - b : b - a));
            const clicked = page.locator('.slot-main a[href*="/p/contract-missing/#"]');
            await clicked.click();
            await waitForBrowse(page);
            const selected = await page.locator('[data-root-href].is-current').getAttribute('data-root-href');
            assert.equal(selected, '/products/');
            const items = await page.locator('[data-breadcrumb-collection-href="/products/free/"] [data-list-entry]').evaluateAll(links => links.map(a => new URL(a.href).pathname));
            assert.deepEqual(items, ordered.map(row => row.href), 'path column order matches product table');
        }
        // Explicit directories must support article entry, not just compile a page.
        await gotoAndWait(page, `${baseUrl}/products/`);
        await page.locator('.slot-main a').filter({ hasText: '$5~$50' }).click();
        await page.locator('.slot-main a[href*="/p/contract-priced/#"]').click();
        await waitForBrowse(page);
        assert.equal(await page.locator('[data-root-href].is-current').getAttribute('data-root-href'), '/products/');
        await context.close();
        console.log('PASS missing-price order, shared path rows, Directory reference article entry');

        // The paid-source icon is absent from the canonical rows, but its symbol
        // must already be available when first-paint/runtime rebuild those rows.
        const noJs = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
        const staticPage = await noJs.newPage();
        const defaultItems = async () => readBreadcrumbData(await staticPage.content(),{directory:builds.directory}).defaultColumns.map(column=>column.selected);
        await staticPage.goto(`${baseUrl}/p/contract-missing/`);
        assert.equal(await staticPage.locator('[data-slot=breadcrumb] [data-list-entry]').count(), 0, 'Path rows are not repeated in article HTML.');
        assert.ok(await staticPage.locator('[data-root-navigation] a').count(), 'Root navigation stays available without JavaScript.');
        assert.equal(await staticPage.locator('use[href="#icon-appearance-light"]').count(), 0);
        assert.equal(await staticPage.locator('symbol#icon-appearance-light').count(), 1, 'source-only SVG is packed without relying on path HTML rows');
        await staticPage.goto(`${baseUrl}/d/contract-override/child/`);
        assert.equal((await defaultItems()).find(item => item.href.includes('/d/contract-override/child/')).icon, 'rss', 'Default metadata preserves inherited icons.');
        await staticPage.goto(`${baseUrl}/p/contract-text/`);
        assert.deepEqual((await defaultItems()).find(item => item.href.includes('/p/contract-text/')).icon, {text:'EN'});
        await staticPage.goto(`${baseUrl}/products/free/`);
        assert.equal(await staticPage.locator('.slot-main a[href*="/p/contract-no-offer/"] img.icon--image').getAttribute('src'), ownImage.image);
        assert.equal(await staticPage.locator('.slot-main a[href*="/p/contract-no-offer/"] .icon--monochrome').count(), 0, 'ordinary images retain their colors');
        assert.equal(await staticPage.locator('.slot-main a[href*="/p/contract-zero/"] .icon--text').textContent(), '<b>EN</b>');
        assert.equal(await staticPage.locator('.icon--text b').count(), 0, 'text icons are escaped during SSR');
        await staticPage.goto(`${baseUrl}/p/contract-image-child/`);
        assert.deepEqual((await defaultItems()).find(item => item.href.includes('/p/contract-image-child/')).icon, inheritedImage, 'Default metadata preserves inherited monochrome images.');
        await staticPage.goto(`${baseUrl}/p/contract-unclassified/`);
        assert.deepEqual((await defaultItems()).find(item => item.href.includes('/p/contract-unclassified/')).icon, {...assetImage,monochrome:true}, 'Default metadata preserves own monochrome images.');
        await noJs.close();

        const iconsContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 960 } });
        const iconsPage = await iconsContext.newPage();
        const selectedIcon = () => iconsPage.locator('[data-slot=breadcrumb] a.is-current[href*="/p/contract-missing/"] use').getAttribute('href');
        await gotoAndWait(iconsPage, `${baseUrl}/products/free/#sort=name-desc`);
        await iconsPage.locator('.slot-main a[href*="/p/contract-missing/#"]').click();
        await waitForBrowse(iconsPage);
        assert.equal(await selectedIcon(), '#icon-product');
        await gotoAndWait(iconsPage, `${baseUrl}/p/contract-missing/#from=products/paid&sort=name-asc`);
        assert.equal(await selectedIcon(), '#icon-appearance-light');
        await iconsPage.reload();
        await waitForBrowse(iconsPage);
        assert.equal(await selectedIcon(), '#icon-appearance-light');
        await iconsPage.goBack();
        await waitForBrowse(iconsPage);
        assert.equal(await selectedIcon(), '#icon-product');
        await iconsPage.goForward();
        await waitForBrowse(iconsPage);
        assert.equal(await selectedIcon(), '#icon-appearance-light');
        for (const prefix of prefixes) {
            await gotoAndWait(iconsPage, `${baseUrl}${prefix}/all/#sort=name-asc`);
            await iconsPage.locator('.slot-main a[href*="/p/contract-unclassified/#"]').click();
            const selectedAsset = () => iconsPage.locator('[data-slot=breadcrumb] .is-current[href*="/p/contract-unclassified/"] img.icon--image.icon--monochrome');
            await waitForBrowse(iconsPage);
            assert.equal(await selectedAsset().getAttribute('src'), assetImage.image);
            await selectedAsset().evaluate(image => image.decode());
            await iconsPage.reload();
            await waitForBrowse(iconsPage);
            assert.equal(await selectedAsset().getAttribute('src'), assetImage.image);
            await iconsPage.goBack();
            await iconsPage.goForward();
            await waitForBrowse(iconsPage);
            assert.equal(await selectedAsset().getAttribute('src'), assetImage.image);
            await gotoAndWait(iconsPage, `${baseUrl}${prefix}/products/free/#sort=name-asc`);
            await iconsPage.locator('.slot-main a[href*="/p/contract-no-offer/#"]').click();
            const selectedImage = () => iconsPage.locator('[data-slot=breadcrumb] .is-current[href*="/p/contract-no-offer/"] img.icon--image');
            await waitForBrowse(iconsPage);
            assert.equal(await selectedImage().getAttribute('src'), ownImage.image);
            await selectedImage().evaluate(image => image.decode());
            await iconsPage.reload();
            await waitForBrowse(iconsPage);
            assert.equal(await selectedImage().getAttribute('src'), ownImage.image);
            await iconsPage.goBack();
            await iconsPage.goForward();
            await waitForBrowse(iconsPage);
            assert.equal(await selectedImage().getAttribute('src'), ownImage.image);
            await gotoAndWait(iconsPage, `${baseUrl}${prefix}/d/contract-image/child/`);
            await iconsPage.locator('.slot-main a[href*="/p/contract-image-child/#"]').click();
            await waitForBrowse(iconsPage);
            assert.equal(await iconsPage.locator('[data-slot=breadcrumb] .is-current[href*="/p/contract-image-child/"] img.icon--image.icon--monochrome').getAttribute('src'), inheritedImage.image);
            await gotoAndWait(iconsPage, `${baseUrl}${prefix}/products/free/#sort=name-asc`);
            await iconsPage.locator('.slot-main a[href*="/p/contract-zero/#"]').click();
            const selectedText = () => iconsPage.locator('[data-slot=breadcrumb] .is-current[href*="/p/contract-zero/"] .icon--text').textContent();
            await waitForBrowse(iconsPage);
            assert.equal(await selectedText(), '<b>EN</b>');
            assert.equal(await iconsPage.locator('.icon--text b').count(), 0, 'runtime icons use textContent');
            await iconsPage.reload();
            await waitForBrowse(iconsPage);
            assert.equal(await selectedText(), '<b>EN</b>');
            await iconsPage.goBack();
            await waitForBrowse(iconsPage);
            await iconsPage.goForward();
            await waitForBrowse(iconsPage);
            assert.equal(await selectedText(), '<b>EN</b>');
            await gotoAndWait(iconsPage, `${baseUrl}${prefix}/d/contract-text/`);
            await iconsPage.locator('.slot-main a[href*="/p/contract-text/#"]').click();
            await waitForBrowse(iconsPage);
            assert.equal(await iconsPage.locator('[data-slot=breadcrumb] .is-current[href*="/p/contract-text/"] .icon--text').textContent(), 'EN');
        }
        await iconsContext.close();
        console.log('PASS inherited/own icons, source-only SVGs, JSON path columns, reload and history');

        await server.setRoot(builds.name);
        const namesContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1024, height: 700 } });
        const namesPage = await namesContext.newPage();
        const paths = selector => namesPage.locator(selector).evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
        const nameGrid = '.slot-main [data-sortable="true"]';
        const mainLinks = `${nameGrid} .item-control`;
        for (const [index, lang] of ['en', 'zh', 'zh-tw'].entries()) {
            const prefix = prefixes[index];
            const ascendingAction = {en:'Sort by Name ascending',zh:'按名称升序排序','zh-tw':'按名稱升冪排序'}[lang];
            const descendingAction = {en:'Sort by Name descending',zh:'按名称降序排序','zh-tw':'按名稱降冪排序'}[lang];
            for (const list of ['d', 'd/contract-inherit', 'products/contract-name', 'contract-name-reference']) {
                const address = `${baseUrl}${prefix}/${list}/`;
                await gotoAndWait(namesPage, address);
                const expected = payload(builds.name, lang, list).rows.map(row => row.href);
                const staticRows = await namesPage.evaluate(async href => {
                    const html = await (await fetch(href)).text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const grid = doc.querySelector('.slot-main [data-sortable]');
                    return { fields: [...grid.querySelectorAll('[data-sort-field]')].map(node => node.dataset.sortField),
                        items: [...grid.querySelectorAll('.item-control')].map(node => new URL(node.getAttribute('href'), location.href).pathname),
                        nonNameCells: grid.querySelectorAll('[data-item-field]:not([data-item-field="name"])').length,
                        action: grid.querySelector('[data-sort-field="name"]').getAttribute('aria-label'),
                        oldCopy: grid.querySelector('[data-sort-title-asc],[data-sort-title-desc]')!==null };
                }, address);
                assert.deepEqual(staticRows, {fields: ['name'], items: expected, nonNameCells: 0, action: descendingAction, oldCopy: false}, 'SSR renders name cells, canonical order and the shared action without per-control copy');
                assert.deepEqual(await paths(mainLinks), expected, 'Hydration preserves SSR order');
                assert.equal(await namesPage.locator(nameGrid).getAttribute('data-sort-columns'), null);
                assert.ok(await namesPage.locator(nameGrid).evaluate(grid => [...grid.children].every(row=>getComputedStyle(row).display==='grid'&&getComputedStyle(row).gridTemplateColumns==='225px')));
                await namesPage.locator(`${nameGrid} [data-sort-field="name"]`).click();
                await namesPage.waitForURL(url => new URLSearchParams(url.hash.slice(1)).get('sort') === 'name-desc');
                assert.equal(await namesPage.locator(`${nameGrid} [data-sort-field="name"]`).getAttribute('aria-label'), ascendingAction);
                assert.equal(await namesPage.locator(`${nameGrid} [data-sort-field="name"]`).getAttribute('title'), ascendingAction);
                const descending = [...expected].reverse();
                assert.deepEqual(await paths(mainLinks), descending, 'Single-column sorting reverses all names');
                const collectionUrl = namesPage.url();
                const articleLink = namesPage.locator(`${mainLinks}[href*="/p/"]`).first();
                const articlePath = await articleLink.evaluate(node => new URL(node.href).pathname);
                await articleLink.click();
                await waitForBrowse(namesPage);
                const column = `[data-slot=breadcrumb] [data-breadcrumb-collection-href="${prefix}/${list}/"]`;
                const assertNameColumn = async () => {
                    assert.equal(new URLSearchParams(new URL(namesPage.url()).hash.slice(1)).get('from'), list);
                    assert.deepEqual(await paths(`${column} .item-control`), descending, 'Article path uses the same name list order');
                    assert.deepEqual(await paths(`${column} .item-control.is-current`), [articlePath]);
                    assert.match(await namesPage.locator(`${column} .path-column-sort`).textContent(), /↓/);
                    assert.equal(await namesPage.locator(`${column} .path-column-sort`).getAttribute('aria-label'), ascendingAction);
                    assert.equal(await namesPage.locator(`${column} .path-column-sort`).getAttribute('title'), ascendingAction);
                };
                await assertNameColumn();
                await namesPage.reload();
                await waitForBrowse(namesPage);
                await assertNameColumn();
                await namesPage.goBack();
                await namesPage.waitForURL(collectionUrl);
                await waitForBrowse(namesPage);
                assert.deepEqual(await paths(mainLinks), descending);
                await namesPage.goForward();
                await waitForBrowse(namesPage);
                await assertNameColumn();
                await namesPage.locator(`${column} .path-column-sort`).click();
                await namesPage.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('↑'), `${column} .path-column-sort`);
                assert.deepEqual(await paths(`${column} .item-control`), expected, 'Path-column toggle uses name sorting too');
                assert.equal(await namesPage.locator(`${column} .path-column-sort`).getAttribute('aria-label'), descendingAction);
                assert.equal(await namesPage.locator(`${column} .path-column-sort`).getAttribute('title'), descendingAction);
            }
        }
        await namesPage.evaluate(() => {
            const copy = JSON.parse(document.body.dataset.collectionSortCopy);
            copy.fields.name = 'Literal <b>$& {field}</b>';
            document.body.dataset.collectionSortCopy = JSON.stringify(copy);
        });
        const literalSort = namesPage.locator('[data-slot=breadcrumb] [data-breadcrumb-collection-href="/zh-tw/contract-name-reference/"] .path-column-sort');
        await literalSort.click();
        await namesPage.waitForFunction(() => document.querySelector('[data-breadcrumb-collection-href="/zh-tw/contract-name-reference/"] [data-sort-indicator]')?.textContent === '↓');
        assert.equal(await literalSort.getAttribute('aria-label'), '按Literal <b>$& {field}</b>升冪排序');
        assert.equal(await literalSort.locator('.path-sort-label').textContent(), 'Literal <b>$& {field}</b>');
        assert.equal(await literalSort.locator('b').count(), 0, 'Field names must remain literal text.');
        await gotoAndWait(namesPage, `${baseUrl}/zh/d/`);
        await namesPage.screenshot({path: path.join(work, 'name-list-zh.png')});
        await gotoAndWait(namesPage, `${baseUrl}/zh/p/contract-missing/#from=products/contract-name&sort=name-desc`);
        await namesPage.screenshot({path: path.join(work, 'name-list-path-zh.png')});
        await namesContext.close();
        console.log('PASS name-only SSR, native layout inheritance, referenced names, ascending/descending sort, path columns and history in three languages');
    } finally {
        await browser.close();
        await server.stop();
    }
    // Price metadata is optional, but a supplied amount must be usable for display/sort.
    const invalidFile = path.join(overlay, 'd/contract-priced/index.md');
    const validContent = fs.readFileSync(invalidFile, 'utf8');
    for (const [name, content, message] of [
        ['currency', validContent.replace('currency: "$", ', ''), 'requires offer.currency'],
        ['amount', validContent.replace('amount: 25', 'amount: -1'), 'Invalid offer.amount'],
        ['icon', validContent.replace('icon: appearance-dark', 'icon: no-such-icon'), 'undefined icon'],
        ['article-default', validContent.replace('icon: appearance-dark', 'icon: appearance-dark\n  list_icon_file: product'), 'only supported on list pages'],
        ['text-empty', validContent.replace('icon: appearance-dark', 'icon: {text: " "}'), 'text must be a non-empty string'],
        ['text-number', validContent.replace('icon: appearance-dark', 'icon: {text: 12}'), 'text must be a non-empty string'],
        ['text-keys', validContent.replace('icon: appearance-dark', 'icon: {text: "©", svg: folder}'), 'object containing only text'],
        ['text-bare', validContent.replace('icon: appearance-dark', 'icon: "©"'), 'undefined icon'],
        ['text-monochrome', validContent.replace('icon: appearance-dark', 'icon: {text: "©", monochrome: true}'), 'image with optional monochrome'],
        ['image-monochrome-string', validContent.replace('icon: appearance-dark', 'icon: {image: "site/favicon.link.svg", monochrome: "true"}'), 'monochrome must be a boolean'],
        ['image-monochrome-number', validContent.replace('icon: appearance-dark', 'icon: {image: "site/favicon.link.svg", monochrome: 1}'), 'monochrome must be a boolean'],
        ['image-empty', validContent.replace('icon: appearance-dark', 'icon: {image: " "}'), 'image must be a non-empty string'],
        ['image-missing', validContent.replace('icon: appearance-dark', 'icon: {image: "missing.webp"}'), 'was not found in page bundle'],
        ['image-page-only', validContent.replace('icon: appearance-dark', 'icon: {image: "./site/favicon.link.svg"}'), 'cannot resolve page bundle asset'],
        ['image-remote', validContent.replace('icon: appearance-dark', 'icon: {image: "https://example.com/a.webp"}'), 'static and remote URLs are not supported'],
        ['image-static', validContent.replace('icon: appearance-dark', 'icon: {image: "/favicon.svg"}'), 'static and remote URLs are not supported'],
        ['image-text', validContent.replace('icon: appearance-dark', 'icon: {image: "not-an-image.txt"}'), 'must reference an image resource']
    ]) {
        write(path.join(overlay, 'd/contract-priced/not-an-image.txt'), 'Not an image.');
        write(invalidFile, content);
        const result = spawnSync(hugo, ['--noBuildLock','--config', `hugo.toml,${rel(config)}`, '--destination', rel(path.join(work, `invalid-${name}`))],
            { cwd: root, env: fixtureEnvironment(work), encoding: 'utf8', windowsHide: true });
        assert.notEqual(result.status, 0, `invalid ${name} must fail the build`);
        assert((result.stdout + result.stderr).includes(message));
    }
    console.log('PASS supplied price and icon declaration validation');
    console.log(`Collection contract checks passed.`);
} finally {
    fs.rmSync(work,{recursive:true,force:true});
}
