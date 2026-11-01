import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import {buildJavaScript} from '../../.agents/skills/swaw-banyan/tasks/_shared/hugo-js.mjs';
import {loadChromium} from '../../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';

const siteRoot = process.cwd();
const browseRoot = path.join(siteRoot, 'module/assets/js/browse');
const navStateEntry = path.join(browseRoot, 'navigation-state.js');
const fragmentEntry = path.join(browseRoot, 'navigation-state.contract.js');
const breadcrumbItemsEntry = path.join(browseRoot, 'breadcrumb-items.js');
const breadcrumbEntry = path.join(browseRoot, 'breadcrumb-entry.js');
const breadcrumbSourceEntry = path.join(browseRoot, 'breadcrumb-source.js');
const entrySourceEntry = path.join(browseRoot, 'entry-source.js');
const rootNavigationEntry = path.join(path.dirname(browseRoot), 'inline/root-navigation.js');
const rootControllerEntry = path.join(browseRoot, 'root-navigation.js');
const collectionItemsEntry = path.join(browseRoot, 'collection-items.js');
const collectionSortEntry = path.join(browseRoot, 'collection-sort.js');
const collectionSortCopyEntry = path.join(browseRoot, 'collection-sort-copy.js');
const tempParent = path.join(os.tmpdir(), 'swaw/banyan/nav-state');
await fs.mkdir(tempParent, {recursive:true});
const tempRoot = await fs.mkdtemp(path.join(tempParent, 'run-'));

try {

    const entries = [navStateEntry, fragmentEntry, breadcrumbItemsEntry, breadcrumbEntry, breadcrumbSourceEntry, entrySourceEntry, rootNavigationEntry, rootControllerEntry, collectionItemsEntry, collectionSortEntry, collectionSortCopyEntry];
    const jsRoot = path.dirname(browseRoot);
    const bundles = await buildJavaScript({jsRoot, work:tempRoot,
        entries:entries.map(entry => path.relative(jsRoot, entry).replace(/\\/g, '/'))
    });
    function bundleFor(entrypoint) {
        return bundles.get(path.relative(jsRoot, entrypoint).replace(/\\/g, '/'));
    }
    async function importBrowserModule(entrypoint) {
        return import(pathToFileURL(bundleFor(entrypoint).file).href);
    }
    function applySorts(module, inputUrl, tokens, defaultTokens = []) {
        const url = new URL(inputUrl);
        module.applySortsTokensToUrl(url, tokens, defaultTokens);
        return `${url.pathname}${url.search}${url.hash}`;
    }

    const navState = await importBrowserModule(navStateEntry);
    const fragment = await importBrowserModule(fragmentEntry);
    const sortCopy = await importBrowserModule(collectionSortCopyEntry);
    const literalCopy = { fields: { name: 'Literal <b>$& {field}</b>' }, actions: { asc: 'Sort {field} ascending' } };
    assert.equal(sortCopy.formatSortAction(literalCopy, 'name', 'asc'), 'Sort Literal <b>$& {field}</b> ascending',
        'Shared sort actions substitute field labels literally.');
    assert.equal(sortCopy.formatSortAction({ fields: {}, actions: {} }, 'date', 'desc'), 'date-desc');
    for (const anchor of ['installation', '章节 + & = / %', 'a+b']) {
        const url = new URL('https://example.test/p/?keep=%2f+value#' + encodeURIComponent(anchor));
        fragment.applyFragmentField(url, 'from', 'd/工具 & A+B');
        fragment.applyFragmentField(url, 'sorts', '_,name-asc');
        assert.equal(url.search, '?keep=%2f+value', 'Fragment writes must preserve real queries byte for byte');
        assert.equal(fragment.readAnchor(url), anchor);
        assert.equal(fragment.readFieldValue(url, 'from'), 'd/工具 & A+B');
        assert.equal(fragment.readFieldValue(url, 'sorts'), '_,name-asc');
        fragment.applyFragmentField(url, 'from', '');
        fragment.applyFragmentField(url, 'sorts', '');
        assert.equal(url.hash, '#' + encodeURIComponent(anchor), 'Anchor-only URLs must stay native');
    }
    assert.equal(fragment.readAnchor('#%invalid'), '', 'Malformed anchors must not throw');
    assert.equal(fragment.readFieldValue(new URL('https://example.test/?from=all#chapter'), 'from'), '',
        'Query fields must not act as navigation state');
    assert.equal(fragment.applyFragmentField(new URL('https://example.test/#sort=name-desc'), 'sort', '').hash, '');

    const collectionSortSources = bundleFor(collectionSortEntry).sources;
    for (const input of ['browse/collection-sort.js', 'browse/sort-policy.js', 'browse/collection-navigation.js']) {
        assert.ok(collectionSortSources.includes(input), 'source map must identify actual entry and imported modules: '+input);
    }
    const pathRuntimeInputs = [
        'browse/breadcrumb-column-sort.js',
        'browse/breadcrumb-items.js',
        'browse/breadcrumb-source.js',
        'browse/path-render.js',
    ];
    assert.deepEqual(
        collectionSortSources.filter(input => pathRuntimeInputs.includes(input)),
        [],
        'collection sort bundle must not include path navigation runtime modules'
    );
    const rootNavigationSources = bundleFor(rootNavigationEntry).sources;
    assert.ok(rootNavigationSources.includes('browse/entry-source.js'),
        'root navigation must read entry source metadata');
    assert.deepEqual(rootNavigationSources.filter(input => [
        'browse/collection-items.js', 'browse/breadcrumb-source.js',
    ].includes(input)), [], 'root navigation must not decode collection rows');

    assert.equal(
        applySorts(
            navState,
            'https://example.test/zh/d/wsl/#sorts=date-desc,date-desc',
            ['date-desc', 'date-desc'],
            ['date-desc', 'date-desc']
        ),
        '/zh/d/wsl/',
        'default lineage sorts should be omitted from URLs'
    );

    assert.equal(
        applySorts(
            navState,
            'https://example.test/zh/p/example/#from=d&sorts=date-desc',
            ['date-desc'],
            ['date-desc']
        ),
        '/zh/p/example/#from=d',
        'default entry lineage sorts should be omitted while preserving from'
    );

    assert.equal(
        applySorts(
            navState,
            'https://example.test/zh/p/example/#from=products/first-party',
            ['', 'name-asc'],
            ['date-desc', 'name-asc']
        ),
        '/zh/p/example/#from=products/first-party',
        'placeholder/default lineage sorts should be omitted when every layer is default'
    );

    assert.equal(
        applySorts(
            navState,
            'https://example.test/zh/p/example/#from=d/wsl',
            ['name-asc', 'date-desc'],
            ['date-desc', 'date-desc']
        ),
        '/zh/p/example/#from=d/wsl&sorts=name-asc,date-desc',
        'non-default ancestor sort should keep the full lineage for depth alignment'
    );

    assert.equal(
        applySorts(
            navState,
            'https://example.test/zh/p/example/#from=d/wsl',
            ['', 'name-asc'],
            ['date-desc', 'date-desc']
        ),
        '/zh/p/example/#from=d/wsl&sorts=_,name-asc',
        'non-default descendant sort should keep placeholder alignment'
    );

    console.log('Navigation state checks passed.');

    globalThis.document = { body: { dataset: {} } };
    globalThis.window = {
        addEventListener() {},
        location: {
            origin: 'https://example.test',
            href: 'https://example.test/zh/p/example/#from=all',
            pathname: '/zh/p/example/',
            search: '',
            hash: '',
        },
    };

    window.location.hash = '#from=d/wsl';
    assert.deepEqual(
        navState.buildLineageSortsTokensForPath('/d/wsl/', '/d/', 'date-asc'),
        ['date-asc', ''],
        'ancestor sort updates should target their own full-lineage slot'
    );
    assert.deepEqual(
        navState.buildLineageSortsTokensForPath('/d/wsl/', '/d/wsl/', 'date-asc'),
        ['', 'date-asc'],
        'active sort updates should target the deepest full-lineage slot'
    );

    const breadcrumbSource = await importBrowserModule(breadcrumbSourceEntry);
    const entrySource = await importBrowserModule(entrySourceEntry);
    const breadcrumbItems = await importBrowserModule(breadcrumbItemsEntry);
    const breadcrumbPath = await importBrowserModule(breadcrumbEntry);
    const collectionItems = await importBrowserModule(collectionItemsEntry);
    const rootController = await importBrowserModule(rootControllerEntry);

    const compositeRows = [
        {
            kind: 'page',
            href: '/zh/p/beta/',
            sort_name: 'Beta',
            sort_size: '2',
        },
        {
            kind: 'page',
            href: '/zh/p/alpha/',
            sort_name: 'Alpha',
            sort_size: '2',
        },
        {
            kind: 'page',
            href: '/zh/p/gamma/',
            sort_name: 'Gamma',
            sort_size: '10',
        },
    ];

    function readCompositeOrder(token, rows = compositeRows, variant = 'all') {
        window.location.hash = `#sort=${token}`;
        window.location.href = `https://example.test/zh/all/${window.location.hash}`;
        return collectionItems.sortItemsRows(rows, variant).rows.map((row) => new URL(row.href, window.location.origin).pathname.split('/').filter(Boolean).at(-1));
    }

    const compositeAsc = readCompositeOrder('size-asc');
    const compositeDesc = readCompositeOrder('size-desc');
    assert.deepEqual(
        compositeAsc,
        ['alpha', 'beta', 'gamma'],
        'numeric primary ties should use the name field as the next ascending tuple component'
    );
    assert.deepEqual(
        compositeDesc,
        compositeAsc.slice().reverse(),
        'descending sort should reverse the complete primary/name tuple'
    );

    const stableKeyRows = [
        {
            kind: 'page',
            href: '/zh/p/second/',
            sort_name: 'Same',
            sort_size: '2',
        },
        {
            kind: 'page',
            href: '/zh/p/first/',
            sort_name: 'Same',
            sort_size: '2',
        },
    ];
    assert.deepEqual(
        readCompositeOrder('size-asc', stableKeyRows),
        ['first', 'second'],
        'stable hrefs should make otherwise equal rows deterministic'
    );
    assert.deepEqual(
        readCompositeOrder('size-desc', stableKeyRows),
        ['second', 'first'],
        'stable hrefs should reverse with the rest of the descending tuple'
    );

    const preciseDateRows = [
        {
            kind: 'page',
            href: '/zh/p/same-day-later/',
            sort_name: 'Same day later',
            sort_date: '20260726134731',
        },
        {
            kind: 'page',
            href: '/zh/p/next-day/',
            sort_name: 'Next day',
            sort_date: '20260727000000',
        },
        {
            kind: 'page',
            href: '/zh/p/same-day-earlier/',
            sort_name: 'Same day earlier',
            sort_date: '20260726120000',
        },
    ];
    assert.deepEqual(
        readCompositeOrder('date-asc', preciseDateRows),
        ['same-day-earlier', 'same-day-later', 'next-day'],
        '14-digit publication date keys should preserve second-level ordering within one display date'
    );
    assert.deepEqual(
        readCompositeOrder('date-desc', preciseDateRows),
        ['next-day', 'same-day-later', 'same-day-earlier'],
        'descending publication date sorting should reverse the complete precise-date tuple'
    );

    const grouped = { rows: [
        { kind: 'page', href: '/p/page-a/', sort_name: '1', sort_date: '20261030120000', sort_count: '4' },
        { kind: 'section', href: '/groups/folder-c/', sort_name: '3', sort_date: '20261010120000', sort_count: '3' },
        { kind: 'page', href: '/p/page-d/', sort_name: '4', sort_date: '20261031120000', sort_count: '2' },
        { kind: 'section', href: '/groups/folder-b/', sort_name: '2', sort_date: '20261020120000', sort_count: '1' },
    ] };
    assert.ok(grouped.rows.every(row => !('key' in row) && !('sort_group' in row)),
        'Decoded rows do not need duplicate URL keys or serialized groups.');
    assert.deepEqual(readCompositeOrder('name-asc',grouped.rows,'section'),['folder-b','folder-c','page-a','page-d'],
        'Ascending section sorting derives folder and article groups from kind before comparing name ranks.');
    assert.deepEqual(readCompositeOrder('name-desc',grouped.rows,'section'),['page-d','page-a','folder-c','folder-b'],
        'Descending section sorting reverses the derived groups and the complete name tuple.');
    assert.deepEqual(readCompositeOrder('date-asc',grouped.rows,'section'),['folder-c','folder-b','page-a','page-d'],
        'Derived groups also apply when sorting by date.');
    assert.deepEqual(readCompositeOrder('date-desc',grouped.rows,'section'),['page-d','page-a','folder-b','folder-c'],
        'Descending dates retain the same complete tuple reversal without sort_group.');

    window.location.href = 'https://example.test/zh/p/example/#from=all';
    window.location.pathname = '/zh/p/example/';
    window.location.hash = '#from=all';

    const allCollectionSource = {
        logicalPath: '/all/',
        provider: 'collection',
        sortVariant: 'all',
        defaultSort: 'date-desc',
        label: 'All',
        href: '/zh/all/',
    };

    assert.deepEqual(
        breadcrumbItems.getCollectionSortState(allCollectionSource),
        {
            collectionSource: {
                logicalPath: '/all/',
                provider: 'collection',
                sortVariant: 'all',
                defaultSort: 'date-desc',
                label: 'All',
                href: '/zh/all/',
            },
            sortVariant: 'all',
            sortToken: 'date-desc',
            field: 'date',
            order: 'desc',
            nextToken: 'date-asc',
            defaultSort: 'date-desc',
            sortsTokens: ['date-desc'],
            defaultSortsTokens: ['date-desc'],
        },
        'column header should expose the active field and direction without adding a field picker'
    );

    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref(allCollectionSource),
        '/zh/p/example/#from=all&sorts=date-asc',
        'column header should toggle only its lineage sort direction'
    );

    window.location.href = 'https://example.test/zh/p/example/#from=all&sort=name-desc&sorts=name-desc';
    window.location.hash = '#from=all&sort=name-desc&sorts=name-desc';
    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref(allCollectionSource),
        '/zh/p/example/#from=all&sort=name-desc&sorts=name-asc',
        'column header should preserve the independent main sort while toggling its lineage slot'
    );

    window.location.href = 'https://example.test/zh/p/example/#from=d/wsl&sorts=name-asc,date-desc';
    window.location.hash = '#from=d/wsl&sorts=name-asc,date-desc';
    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref({
            logicalPath: '/d/wsl/',
            provider: 'collection',
            sortVariant: 'section',
            defaultSort: 'date-desc',
            label: 'WSL',
            href: '/zh/d/wsl/',
        }),
        '/zh/p/example/#from=d/wsl&sorts=name-asc,date-asc',
        'nested column toggles should preserve ancestor sort state and replace only the current slot'
    );

    const directoryCollectionSource = {
        logicalPath: '/d/',
        provider: 'collection',
        sortVariant: 'section',
        defaultSort: 'date-desc',
        label: 'Directory',
        href: '/zh/d/',
    };
    const wslCollectionSource = {
        logicalPath: '/d/wsl/',
        provider: 'collection',
        sortVariant: 'section',
        defaultSort: 'date-desc',
        label: 'WSL',
        href: '/zh/d/wsl/',
    };

    window.location.href = 'https://example.test/zh/p/example/#from=d/wsl';
    window.location.hash = '#from=d/wsl';
    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref(directoryCollectionSource),
        '/zh/p/example/#from=d/wsl&sorts=date-asc,_',
        'ancestor column toggles should preserve the full lineage and update only the ancestor slot'
    );
    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref(wslCollectionSource),
        '/zh/p/example/#from=d/wsl&sorts=_,date-asc',
        'active column toggles should update only the deepest lineage slot'
    );

    window.location.href = 'https://example.test/zh/p/example/#from=d/wsl&sort=date-asc&sorts=_,date-asc';
    window.location.hash = '#from=d/wsl&sort=date-asc&sorts=_,date-asc';
    assert.equal(
        breadcrumbItems.getCollectionSortState(directoryCollectionSource)?.sortToken,
        'date-desc',
        'the active sort alias must not leak into an ancestor column'
    );
    assert.equal(
        breadcrumbItems.getCollectionSortState(wslCollectionSource)?.sortToken,
        'date-asc',
        'the deepest column should read its own lineage slot'
    );

    window.location.href = 'https://example.test/zh/d/wsl/#from=d&sort=name-asc';
    window.location.pathname = '/zh/d/wsl/';
    window.location.hash = '#from=d&sort=name-asc';
    assert.equal(
        breadcrumbItems.getCollectionSortState(directoryCollectionSource)?.sortToken,
        'date-desc',
        'a main-grid sort must not leak into a breadcrumb column without a lineage override'
    );
    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref(directoryCollectionSource),
        '/zh/d/wsl/#from=d&sort=name-asc&sorts=date-asc',
        'breadcrumb sorting should preserve the main-grid sort while updating only its lineage slot'
    );

    window.location.href = 'https://example.test/zh/d/wsl/#from=d&sort=name-asc&sorts=date-asc';
    window.location.hash = '#from=d&sort=name-asc&sorts=date-asc';
    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref(directoryCollectionSource),
        '/zh/d/wsl/#from=d&sort=name-asc',
        'returning a breadcrumb column to its default should remove sorts without changing sort'
    );

    window.location.href = 'https://example.test/zh/discover/tooling/devtools/windows/wsl/';
    window.location.pathname = '/zh/discover/tooling/devtools/windows/wsl/';
    window.location.hash = '';
    assert.equal(
        breadcrumbItems.buildCollectionSortToggleHref(
            directoryCollectionSource,
            window.location.href,
            '/d/wsl/'
        ),
        '/zh/discover/tooling/devtools/windows/wsl/#from=d/wsl&sorts=date-asc,_',
        'a visible-lineage override should preserve every column slot when no from state exists yet'
    );

    window.location.href = 'https://example.test/zh/p/example/#from=discover/windows';
    window.location.hash = '#from=discover/windows';

    assert.equal(
        breadcrumbItems.buildBreadcrumbRowHref(
            { kind: 'page', href: '/zh/p/contract-beta/#from=discover/windows', text: '紧凑标题' },
            { logicalPath: '/discover/windows/', provider: 'collection' },
            { sortToken: '', defaultSort: 'date-desc', sortsTokens: [],
                defaultSortsTokens: ['date-desc', 'date-desc'] }
        ),
        '/zh/p/contract-beta/#from=discover/windows',
        'entry hrefs should preserve the non-default source supplied by the fragment'
    );
    assert.equal(
        breadcrumbItems.buildBreadcrumbRowHref(
            { kind: 'page', href: '/zh/p/contract-beta/', text: 'Beta' },
            { logicalPath: '/discover/windows/', provider: 'collection' },
            {}
        ),
        '/zh/p/contract-beta/',
        'entry hrefs must not add a source to a clean default link'
    );

    const hashes = { discover: 'a'.repeat(64), windows: 'b'.repeat(64), unicode: 'c'.repeat(64), updated: 'd'.repeat(64), notes: 'f'.repeat(64) };
    const manifest = {
        home: '/zh/',
        resources: '/base/site/navigation/',
        columns: {
            '/discover/': hashes.discover,
            '/discover/windows/': hashes.windows,
            '/discover/%E5%B7%A5%E5%85%B7/': hashes.unicode,
            '/notes/': hashes.notes,
        },
        default: '/notes/',
        error: 'Navigation could not load.',
    };
    const parsed = entrySource.parseNavigation(JSON.stringify(manifest));
    const defaultRoute = { root: '/zh/notes/', columns: [{ column: '/notes/' }], lineage: '/notes/', from: '' };
    assert.deepEqual(parsed.columns['/discover/windows/'], { hash: hashes.windows, href: '/zh/discover/windows/' });
    assert.deepEqual(entrySource.selectNavigationRoute(parsed, '/discover/windows/'), {
        root: '/zh/discover/', lineage: '/discover/windows/', from: '/discover/windows/',
        columns: [{ column: '/discover/', selected: '/zh/discover/windows/' }, { column: '/discover/windows/' }],
    }, 'column prefixes must define the route without inline paths');
    assert.deepEqual(entrySource.selectNavigationRoute(parsed, 'discover/%E5%B7%A5%E5%85%B7').columns,
        [{ column: '/discover/', selected: '/zh/discover/%E5%B7%A5%E5%85%B7/' }, { column: '/discover/工具/' }],
        'Unicode keys normalize while selected links retain their encoded URL');
    assert.equal(entrySource.selectNavigationRoute(parsed, '/discover/').from, '/discover/',
        'an available ancestor is a candidate until its loaded rows validate the current article');
    assert.deepEqual(entrySource.selectNavigationRoute(parsed, '/discover/windows/', '/discover/windows/'),
        { ...defaultRoute, lineage: '/discover/windows/' },
        'a collection page must keep its own sort lineage while its columns use the default path');
    const collectionNavigation = entrySource.parseNavigation(JSON.stringify({ ...manifest,
        default: '/discover/', columns: { '/discover/': hashes.discover } }));
    assert.deepEqual(entrySource.selectNavigationRoute(collectionNavigation, '', '/discover/windows/'), {
        root: '/zh/discover/', columns: [{ column: '/discover/' }], lineage: '/discover/windows/', from: '',
    }, 'a collection without from must keep its main-list lineage without adding its main list as a path column');
    for (const from of ['/discover/windows/contract-beta/', '/discover/unknown/', '/products/windows/', '']) {
        assert.deepEqual(entrySource.selectNavigationRoute(parsed, from), defaultRoute,
            'a missing terminal resource must select the default route');
    }
    for (const invalid of ['{', '[]', 'null', '{}', '{"routes":[],"columns":[],"from":{}}']) {
        assert.equal(entrySource.parseNavigation(invalid), null, 'invalid navigation data must not throw');
    }

    const previousDocument = globalThis.document;
    try {
        globalThis.document = { body: { dataset: {} } };
        for (const raw of ['', '{', 'null', '{}']) {
            document.body.dataset.collectionSortCopy = raw;
            assert.deepEqual(sortCopy.readCollectionSortCopy(), { fields: {}, actions: {} });
        }
        document.body.dataset.collectionSortCopy = JSON.stringify(literalCopy);
        assert.deepEqual(sortCopy.readCollectionSortCopy(), literalCopy);
        document.body.dataset.collectionSortCopy = JSON.stringify({ ...literalCopy, fields: { name: 'Changed' } });
        assert.equal(sortCopy.readCollectionSortCopy().fields.name, 'Changed');
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }

    const nativeSources = path.join(tempRoot, 'native-sources');
    await fs.cp(jsRoot, nativeSources, { recursive: true });
    await fs.writeFile(path.join(nativeSources, 'navigation-test.js'), [
        "export * as source from './browse/breadcrumb-source.js';",
        "export * as entry from './browse/breadcrumb-entry.js';",
        "export * as render from './browse/path-render.js';",
        "export * as sort from './browse/breadcrumb-column-sort.js';",
        "export * as root from './browse/root-navigation.js';",
        "export * as metadata from './browse/entry-source.js';",
        "export * as fragment from './browse/navigation-state.contract.js';",
    ].join('\n'));
    const nativeBundles = await buildJavaScript({ jsRoot: nativeSources, work: path.join(tempRoot, 'native'),
        entries: ['navigation-test.js'] });
    const code = await fs.readFile(nativeBundles.get('navigation-test.js').file, 'utf8');
    const engine = loadChromium();
    const browser = await engine.launch({ headless: true, executablePath: engine.executablePath() });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.route('https://example.test/**', route => route.fulfill({
            contentType: 'text/html', body: '<!doctype html><html><body></body></html>',
        }));
        const page = await context.newPage();
        await page.goto('https://example.test/zh/p/contract-beta/');
        const result = await page.evaluate(async ({ code, manifest, hashes }) => {
            const check = (value, message) => { if (!value) throw new Error(message); };
            const same = (actual, expected, message) => check(JSON.stringify(actual) === JSON.stringify(expected),
                message + ': ' + JSON.stringify(actual));
            const imported = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
            const { source, entry, render, sort, root, metadata, fragment } = await import(imported);
            const loadColumns = columns => Promise.allSettled(columns.map(source.loadBreadcrumbColumn));
            URL.revokeObjectURL(imported);
            const esc = value => String(value).replace(/[&<>"]/g, character =>
                ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
            const rowHTML = row => '<div class="list-item" data-list-item data-kind="' + esc(row.kind || 'page')
                + '" data-sort-name="' + esc(row.rank || '1') + '" data-sort-date="20261001000000" data-sort-count="1">'
                + '<a class="item-control item-field item-field--name" data-item-field="name" data-list-entry href="'
                + esc(row.href) + '" title="' + esc(row.title || row.text) + '">'
                + (row.icon || '<span class="item-icon"><svg class="icon icon-file" aria-hidden="true" focusable="false"><use href="#icon-file"></use></svg></span>')
                + '<span class="item-title"><bdi>' + esc(row.text) + '</bdi></span></a></div>';
            const columnHTML = (logicalPath, label, href, rows, sortable = true) =>
                '<div class="item-list item-list--path-column" data-navigation-column="' + esc(logicalPath)
                + '" data-sort-variant="' + (sortable ? 'section' : '') + '" data-default-sort="' + (sortable ? 'date-desc' : '') + '">'
                + '<div class="list-item list-header list-header--path" data-list-header><span class="item-field item-field--name" data-item-field="name">'
                + '<a class="path-column-label" href="' + esc(href) + '" title="' + esc(label) + '"><bdi>' + esc(label) + '</bdi></a>'
                + (sortable ? '<span class="path-column-separator" aria-hidden="true">·</span><a class="path-column-sort" data-collection-sort-toggle="true" href="'
                    + esc(href) + '"><span class="path-sort-label">Date</span><span class="list-sort-indicator" data-sort-indicator aria-hidden="true">↓</span></a>' : '')
                + '</span></div>' + rows.map(rowHTML).join('') + '</div>';
            const fragments = {
                discover: columnHTML('/discover/', 'Discover', '/zh/discover/', [
                    { kind: 'section', href: '/zh/discover/windows/', text: 'Windows', title: 'Windows development' },
                ]),
                windows: columnHTML('/discover/windows/', 'Windows', '/zh/discover/windows/', [
                    { href: '/zh/p/contract-beta/#from=discover/windows', text: 'Beta', title: 'Beta detailed article title', rank: '2',
                        icon: '<span class="item-icon item-icon--text" aria-hidden="true"><span class="icon icon--text" aria-hidden="true">β</span></span>' },
                    { href: '/zh/p/contract-alpha/#from=discover/windows', text: 'Alpha' },
                ]),
                notes: columnHTML('/notes/', 'Notes', '/zh/notes/', [{ href: '/zh/p/contract-beta/', text: 'Beta' }]),
            };
            document.body.innerHTML = '<nav data-root-navigation data-default-root-href="/zh/notes/">'
                + ['/zh/notes/', '/zh/discover/', '/zh/all/'].map(href => '<a data-root-href="' + href + '" href="' + href + '">Root</a>').join('')
                + '</nav><nav data-slot="breadcrumb"><div class="page-column path-column" data-collection-column="true"></div>'
                + '<div class="page-column path-column" data-collection-column="true"></div></nav>';
            document.body.dataset.navigation = JSON.stringify(manifest);
            document.body.dataset.collectionSortCopy = JSON.stringify({
                fields: { name: 'Name', date: 'Updated', count: 'Count' }, actions: { asc: 'Sort {field} ascending', desc: 'Sort {field} descending' },
            });
            const setLocation = href => history.replaceState(history.state, '', href);
            setLocation('/zh/p/contract-beta/#from=discover/windows');
            const response = text => ({ ok: true, text: async () => text });
            let release;
            const gate = new Promise(resolve => { release = resolve; }), requests = [];
            window.fetch = async (url, options) => {
                requests.push(url);
                check(options.credentials === 'same-origin' && options.signal instanceof AbortSignal, 'Loader must retain same-origin cancellation.');
                check(!options.headers, 'Text fragments must not request full HTML document negotiation.');
                await gate;
                return response(url.includes(hashes.discover) ? fragments.discover : fragments.windows);
            };
            const cached = metadata.readNavigation(), columns = source.readBreadcrumbColumns();
            check(metadata.readNavigation() === cached, 'Unchanged manifests must remain cached.');
            same(columns.map(column => column.selected), ['/zh/discover/windows/', '/zh/p/contract-beta/'], 'Selection derives from path and URL.');
            check(columns[1].payload === null, 'Missing resources must retain unloaded-column state.');
            check(source.readBreadcrumbColumn('/discover/工具/').url === manifest.resources + hashes.unicode + '.txt', 'Unicode keys must resolve text resources.');
            const first = loadColumns(columns), duplicate = loadColumns([...columns].reverse());
            check(requests.length === 2, 'Concurrent columns load in parallel and duplicate requests are shared.');
            release();await Promise.all([first, duplicate]);
            const loaded = source.readBreadcrumbColumns();
            check(loaded[1].source === loaded[1].payload && loaded[1].source.label === 'Windows', 'Fragment metadata supplies the source.');
            check(loaded[1].payload.rows.length === 2 && columns[1].payload === null, 'New data must not mutate previous column snapshots.');
            await loadColumns(loaded);check(requests.length === 2, 'Successful fragments remain cached.');
            const nav = document.querySelector('[data-slot=breadcrumb]'), reserved = [...nav.children];
            const slots = render.preparePathColumns(loaded);
            const nativeAppend = Node.prototype.appendChild;
            let movedRows = 0;
            Node.prototype.appendChild = function(node) {
                if (node instanceof Element && node.matches('[data-list-item]')) movedRows++;
                return nativeAppend.call(this, node);
            };
            try {
                loaded.forEach((column, index) => render.fillPathColumn(slots[index], column, manifest.error, '/discover/windows/'));
            } finally { Node.prototype.appendChild = nativeAppend; }
            same([...nav.children[1].querySelectorAll('.item-title > bdi')].map(node => node.textContent), ['Beta', 'Alpha'],
                'Default ordering must retain the compiled fragment order.');
            check(movedRows === 0, 'Default rendering must not move already ordered row elements.');
            check(fragment.readFieldValue(nav.children[0].querySelector('[data-collection-sort-toggle]').hash, 'sorts') === 'date-asc,_',
                'The first render must build header links for the full lineage.');
            check(reserved.every((node, index) => node === nav.children[index]), 'Rendering must retain outer scrolling containers.');
            const selected = nav.children[1].querySelector('[aria-current=page]');
            check(selected.title === 'Beta detailed article title' && selected.querySelector('.icon--text').textContent === 'β',
                'Native fragment cloning must retain tooltip and text-icon markup.');
            check(nav.children[0].querySelector('[aria-current=page]').title === 'Windows development', 'Ancestor selection retains its title.');
            const oldLinks = [...nav.children[1].querySelectorAll('[data-list-entry]')];
            oldLinks[0].focus();const focused = document.activeElement;
            setLocation('/zh/p/contract-beta/?keep=%2f+value#from=discover/windows&sorts=_,name-asc&anchor=chapter');
            sort.refreshBreadcrumbCollectionColumns('/discover/windows/');
            check(oldLinks.every(link => link.isConnected), 'Sorting must retain live nodes.');
            check(document.activeElement === focused, 'Sorting must retain focus when rows move.');
            check(nav.children[1].querySelector('[data-list-entry]').title === 'Alpha', 'Sorting reorders cloned row elements.');
            check(selected.hash.includes('from=discover/windows'), 'Row links inherit source state.');

            const updated = structuredClone(manifest);updated.columns['/discover/windows/'] = hashes.updated;
            document.body.dataset.navigation = JSON.stringify(updated);
            check(metadata.readNavigation() !== cached, 'A changed manifest invalidates only its parsed metadata.');
            const unloaded = source.readBreadcrumbColumn('/discover/windows/');
            check(unloaded.payload === null, 'A changed hash must not reuse the old template.');
            const badFragments = [
                '', '<p>Not a column</p>', fragments.discover,
                fragments.windows + fragments.notes, fragments.windows + 'unexpected text',
                fragments.windows.replace('<div class=', '<script></script><div class='),
                fragments.windows.replace('data-kind="page"', 'onpointerenter="alert(1)" data-kind="page"'),
                fragments.windows.replace('data-kind="page"', 'style="position:fixed" data-kind="page"'),
                fragments.windows.replace('/zh/p/contract-beta/', 'javascript:void(0)'),
                fragments.windows.replace('/zh/p/contract-beta/', 'https://outside.test/article/'),
                fragments.windows.replace('/zh/discover/windows/', 'https://outside.test/column/'),
                fragments.windows.replace('<use href="#icon-file">', '<use href="https://outside.test/icon.svg#file">'),
                fragments.windows.replace('<span class="icon icon--text" aria-hidden="true">β</span>',
                    '<img src="https://outside.test/icon.png" alt="">'),
                fragments.windows.replace('<span class="icon icon--text" aria-hidden="true">β</span>', '<iframe src="/frame/"></iframe>'),
                fragments.windows.replace('<span class="path-sort-label">Date</span>', ''),
                fragments.windows.replace('data-default-sort="date-desc"', 'data-default-sort="date-desc-extra"'),
                fragments.windows.replace('<bdi>Alpha</bdi>', '<div data-list-item>Extra marker</div><bdi>Alpha</bdi>'),
            ];
            for (const html of badFragments) {
                window.fetch = async () => response(html);
                check((await loadColumns([unloaded]))[0].status === 'rejected', 'Malformed or active HTML must not enter the cache.');
                check(source.readBreadcrumbColumn('/discover/windows/').payload === null, 'Failed fragments remain retryable.');
            }
            window.fetch = async () => ({ ok: false });
            check((await loadColumns([unloaded]))[0].status === 'rejected', 'HTTP failures remain retryable.');
            window.fetch = async () => response(fragments.windows.replace('>Beta<', '>Updated Beta<'));
            check((await loadColumns([unloaded]))[0].status === 'fulfilled', 'A failed fragment can be retried.');
            check(source.readBreadcrumbColumn('/discover/windows/').payload.template.content.textContent.includes('Updated Beta'), 'Retry uses the new HTML.');
            check(!loaded[1].payload.template.content.textContent.includes('Updated Beta'), 'The old cached snapshot remains unchanged.');

            let invalidRequests = 0;window.fetch = async () => { invalidRequests++;throw new Error('Unexpected request'); };
            for (const url of ['https://outside.test/column.txt', 'blob:https://example.test/resource', '']) {
                check((await loadColumns([{ key: '/missing/', url }]))[0].status === 'rejected', 'Invalid resource URLs fail before fetch.');
            }
            check(invalidRequests === 0, 'Cross-origin and missing resources must not be fetched.');
            const invalidHash = structuredClone(manifest);invalidHash.columns['/discover/windows/'] = 'not-a-hash';
            document.body.dataset.navigation = JSON.stringify(invalidHash);
            check(source.readBreadcrumbColumn('/discover/windows/').url === '', 'Only content-hash resource names are accepted.');
            const nativeTimeout = window.setTimeout, nativeClear = window.clearTimeout;
            let abort, cleared = false;
            window.setTimeout = (callback, delay) => { check(delay === 8000, 'Requests must keep the eight-second bound.');abort = callback;return 1; };
            window.clearTimeout = () => { cleared = true; };
            window.fetch = (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
            try {
                const timed = loadColumns([{ key: '/timeout/', url: manifest.resources + 'e'.repeat(64) + '.txt' }]);
                abort();check((await timed)[0].status === 'rejected' && cleared, 'A stalled request must abort and clear its timer.');
            } finally {window.setTimeout = nativeTimeout;window.clearTimeout = nativeClear;}

            document.body.dataset.navigation = JSON.stringify(manifest);
            window.fetch = async url => response(url.includes(hashes.notes) ? fragments.notes : fragments.discover);
            const startPending = () => document.documentElement.setAttribute('data-entry-breadcrumb-pending', 'true');
            setLocation('/zh/p/contract-beta/?keep=%2f+value#from=discover&sort=name-desc&sorts=date-asc&anchor=chapter');
            startPending();await entry.initializeBreadcrumb();
            check(fragment.readFieldValue(location.hash, 'from') === '', 'A loaded terminal without the current article clears invalid from.');
            check(location.search === '?keep=%2f+value' && fragment.readFieldValue(location.hash, 'sort') === 'name-desc'
                && fragment.readFieldValue(location.hash, 'sorts') === 'date-asc' && fragment.readAnchor(location.hash) === 'chapter',
                'Invalid source cleanup must retain queries, independent sorting and anchors.');
            same([...nav.children].map(node => node.dataset.navigationColumn), ['/notes/'], 'Invalid membership restores the default columns.');
            check(!document.documentElement.hasAttribute('data-entry-breadcrumb-pending'), 'Initialization clears pending flags.');
            setLocation('/zh/p/contract-beta/#from=missing&anchor=chapter');startPending();await entry.initializeBreadcrumb();
            check(fragment.readFieldValue(location.hash, 'from') === '' && fragment.readAnchor(location.hash) === 'chapter', 'Missing terminal references preserve anchors.');

            const unavailable = structuredClone(manifest);unavailable.columns['/discover/'] = '1'.repeat(64);
            document.body.dataset.navigation = JSON.stringify(unavailable);window.fetch = async () => ({ ok: false });
            setLocation('/zh/p/contract-beta/#from=discover');startPending();await entry.initializeBreadcrumb();
            check(fragment.readFieldValue(location.hash, 'from') === 'discover' && nav.firstElementChild.hasAttribute('data-navigation-failed'),
                'Network failure must preserve the requested path and error column.');
            const own = structuredClone(manifest);own.default = '/discover/';delete own.columns['/discover/windows/'];
            document.body.dataset.navigation = JSON.stringify(own);document.body.dataset.collectionPath = '/discover/windows/';
            window.fetch = async () => { throw new Error('Own main list must not require its missing resource'); };
            setLocation('/zh/discover/windows/#from=discover/windows');startPending();await entry.initializeBreadcrumb();
            check(fragment.readFieldValue(location.hash, 'from') === 'discover/windows', 'Own collection sources do not require self-membership.');
            same([...nav.children].map(node => node.dataset.navigationColumn), ['/discover/'], 'Own collection uses only ancestor columns.');
            delete own.columns['/discover/%E5%B7%A5%E5%85%B7/'];document.body.dataset.navigation = JSON.stringify(own);
            document.body.dataset.collectionPath = '/discover/%E5%B7%A5%E5%85%B7/';
            setLocation('/zh/discover/%E5%B7%A5%E5%85%B7/#from=discover/%E5%B7%A5%E5%85%B7');startPending();await entry.initializeBreadcrumb();
            check(fragment.readFieldValue(location.hash, 'from') === 'discover/工具', 'Encoded own-entry paths remain valid.');

            const race = structuredClone(manifest);race.columns['/discover/'] = '3'.repeat(64);race.columns['/discover/windows/'] = '2'.repeat(64);
            document.body.dataset.navigation = JSON.stringify(race);delete document.body.dataset.collectionPath;
            let releaseRace;const raceGate = new Promise(resolve => { releaseRace = resolve; });
            window.fetch = async url => { if (url.includes('2'.repeat(64))) await raceGate;
                return response(url.includes('2'.repeat(64)) ? fragments.windows : fragments.discover); };
            setLocation('/zh/p/contract-beta/#from=discover/windows');startPending();const older = entry.initializeBreadcrumb();
            setLocation('/zh/p/contract-beta/#from=notes');startPending();await entry.initializeBreadcrumb();
            const currentNodes = [...nav.children];releaseRace();
            check((await older).stale && currentNodes.every((node, index) => node === nav.children[index]), 'An older request must not overwrite the current DOM.');
            check(fragment.readFieldValue(location.hash, 'from') === 'notes', 'An older request must not clear a newer source.');

            window.fetch = async () => { invalidRequests++;throw new Error('Root navigation must not fetch'); };
            setLocation('/zh/p/contract-beta/#from=discover/windows');root.refreshRootSelection();
            check(document.querySelector('[data-root-navigation] [aria-current=page]').dataset.rootHref === '/zh/discover/', 'Root selection uses metadata alone.');
            setLocation('/zh/p/contract-beta/#from=unregistered');root.refreshRootSelection();
            check(document.querySelector('[data-root-navigation] [aria-current=page]').dataset.rootHref === '/zh/notes/', 'Invalid roots retain the default selection.');
            check(invalidRequests === 0, 'Root selection requires no resources.');
            nav.remove();startPending();document.documentElement.setAttribute('data-breadcrumb-sort-pending', 'true');
            await entry.initializeBreadcrumb();
            check(!document.documentElement.hasAttribute('data-entry-breadcrumb-pending')
                && !document.documentElement.hasAttribute('data-breadcrumb-sort-pending'), 'Pages without a path host clear pending state.');
            return { malformedFragments: badFragments.length, requests: 2, nativeDOM: true };
        }, { code, manifest, hashes });
        console.log('Native browser fragment and entry checks passed: ' + JSON.stringify(result));
        await context.close();
    } finally {await browser.close();}
} finally {
    await fs.rm(tempRoot,{recursive:true,force:true});
}
