import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import {buildJavaScript} from '../../.agents/skills/swaw-banyan/tasks/_shared/hugo-js.mjs';

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

    const grouped = collectionItems.decodeItemsPayload({v:1,p:'collection',lp:'/groups/',sv:'section',ds:'date-desc',
        f:['kind','href','text','sort_name','sort_date','sort_count'],rv:[
            'page','/p/page-a/','A','1','20261030120000','4',
            'section','/groups/folder-c/','C','3','20261010120000','3',
            'page','/p/page-d/','D','4','20261031120000','2',
            'section','/groups/folder-b/','B','2','20261020120000','1',
        ]});
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
            { kind: 'page', href: '/zh/p/contract-beta/', text: '紧凑标题' },
            { logicalPath: '/discover/windows/', provider: 'collection' },
            { sortToken: '', defaultSort: 'date-desc', sortsTokens: [],
                defaultSortsTokens: ['date-desc', 'date-desc'] }
        ),
        '/zh/p/contract-beta/#from=discover/windows',
        'entry hrefs should write collection-only from values'
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
    const payloads = {
        discover: {
            v: 1, p: 'collection', lp: '/discover/', label: 'Discover', href: '/zh/discover/',
            sv: 'section', ds: 'date-desc',
            f: ['kind', 'href', 'text', 'icon', 'sort_name', 'sort_date', 'sort_count', 'title'],
            rv: ['section', '/zh/discover/windows/', 'Windows', 'folder', '1', '20260626000000', '2', 'Windows development'],
        },
        windows: {
            v: 1, p: 'collection', lp: '/discover/windows/', label: 'Windows', href: '/zh/discover/windows/',
            sv: 'section', ds: 'date-desc',
            f: ['kind', 'href', 'text', 'icon', 'sort_name', 'sort_date', 'sort_count', 'title'],
            rv: [
                'page', '/zh/p/contract-alpha/', 'Alpha', 'file', '1', '20260626000000', '6402', '',
                'page', '/zh/p/contract-beta/', 'Beta', { text: 'β' }, '2', '20260624000000', '1341', 'Beta detailed article title',
            ],
        },
        notes: {
            v: 1, p: 'collection', lp: '/notes/', label: 'Notes', href: '/zh/notes/', sv: 'section', ds: 'date-desc',
            f: ['kind', 'href', 'text', 'sort_name'], rv: ['page', '/zh/p/contract-beta/', 'Beta', '1'],
        },
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
    const previousFetch = globalThis.fetch;
    globalThis.document = { body: { dataset: { navigation: JSON.stringify(manifest) } } };
    for (const raw of ['', '{', 'null', '{}']) {
        document.body.dataset.collectionSortCopy = raw;
        assert.deepEqual(sortCopy.readCollectionSortCopy(), { fields: {}, actions: {} }, 'Missing or malformed copy remains usable.');
    }
    document.body.dataset.collectionSortCopy = JSON.stringify(literalCopy);
    assert.deepEqual(sortCopy.readCollectionSortCopy(), literalCopy);
    document.body.dataset.collectionSortCopy = JSON.stringify({ ...literalCopy, fields: { name: 'Changed' } });
    assert.equal(sortCopy.readCollectionSortCopy().fields.name, 'Changed', 'Header refresh reads the current shared copy.');
    window.location.href = 'https://example.test/zh/p/contract-beta/#from=discover/windows';
    window.location.pathname = '/zh/p/contract-beta/';
    window.location.hash = '#from=discover/windows';
    const requests = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    globalThis.fetch = async (url, options) => {
        requests.push(url);
        assert.equal(options.credentials, 'same-origin');
        assert.ok(options.signal instanceof AbortSignal);
        await gate;
        return { ok: true, json: async () => url.includes(hashes.discover) ? payloads.discover : payloads.windows };
    };
    try {
        const cached = entrySource.readNavigation();
        assert.equal(entrySource.readNavigation(), cached, 'unchanged inline data must reuse its parsed manifest');
        const columns = breadcrumbSource.readBreadcrumbColumns();
        assert.equal(columns.length, 2);
        assert.equal(columns[0].selected, '/zh/discover/windows/');
        assert.equal(columns[1].selected, window.location.pathname,
            'the current row must use the current URL when selected is omitted');
        assert.equal(columns[1].payload, null, 'HTML must not contain column rows');
        assert.equal(breadcrumbSource.readBreadcrumbColumn('/discover/工具/').url,
            manifest.resources + hashes.unicode + '.json', 'encoded and decoded column keys must resolve the same resource');
        const failed = breadcrumbPath.buildPathColumn(columns[1]);
        assert.deepEqual(failed.items, [], 'a missing resource must not synthesize a selected row');
        assert.equal(failed.failed, true);

        const firstLoad = breadcrumbSource.loadBreadcrumbColumns(columns);
        const duplicateLoad = breadcrumbSource.loadBreadcrumbColumns([columns[1], columns[0]]);
        assert.equal(requests.length, 2, 'different columns must start in parallel and duplicate references must share requests');
        release();
        await Promise.all([firstLoad, duplicateLoad]);
        assert.equal(entrySource.readNavigation(), cached, 'loaded rows must not invalidate inline route metadata');
        const loaded = breadcrumbSource.readBreadcrumbColumns();
        assert.equal(loaded[1].source, loaded[1].payload, 'the shared JSON also supplies the collection source');
        assert.equal(loaded[1].source.label, 'Windows');
        assert.equal(loaded[1].source.href, '/zh/discover/windows/');
        assert.equal(columns[1].payload, null, 'loading rows must not mutate previous column objects');
        assert.equal(breadcrumbSource.readBreadcrumbColumn('/discover/windows/').payload, loaded[1].payload);
        await breadcrumbSource.loadBreadcrumbColumns(loaded);
        assert.equal(requests.length, 2, 'completed requests must remain cached');

        const model = breadcrumbPath.buildPathColumn(loaded[1]);
        assert.equal(model.failed, false);
        assert.equal(model.items.filter(item => item.current).length, 1);
        const current = model.items.find(item => item.current);
        assert.equal(current.text, 'Beta');
        assert.equal(current.title, 'Beta detailed article title', 'the normal selected tooltip must come from shared JSON');
        assert.deepEqual(current.icon, { text: 'β' }, 'shared row icons must survive path rendering');
        assert.ok(model.items.every(item => !('column_items' in item) && !('collection_source' in item)));
        const ancestor = breadcrumbPath.buildPathColumn(loaded[0]).items.find(item => item.current);
        assert.equal(ancestor.text, 'Windows');
        assert.equal(ancestor.title, 'Windows development', 'ancestor tooltips must also come from their JSON rows');

        const updatedManifest = structuredClone(manifest);
        updatedManifest.columns['/discover/windows/'] = hashes.updated;
        document.body.dataset.navigation = JSON.stringify(updatedManifest);
        assert.notEqual(entrySource.readNavigation(), cached, 'a changed manifest must invalidate its parsed cache');
        assert.equal(cached.columns['/discover/windows/'].hash, hashes.windows);
        const unloaded = breadcrumbSource.readBreadcrumbColumn('/discover/windows/');
        assert.equal(unloaded.payload, null, 'a new content hash must not reuse old rows');
        for (const response of [
            { ok: false },
            { ok: true, json: async () => { throw new SyntaxError('bad JSON'); } },
            { ok: true, json: async () => ({ v: 1 }) },
            { ok: true, json: async () => payloads.discover },
            ...[
                { v: 2 }, { p: 'other' }, { label: '' }, { href: null },
                { href: 'javascript:alert(1)' }, { href: 'https://outside.test/column/' },
            ].map(change => ({ ok: true, json: async () => ({ ...payloads.windows, ...change }) })),
            ...['javascript:void(0)', 'https://outside.test/article/'].map(href => ({
                ok: true, json: async () => ({ ...payloads.windows,
                    rv: payloads.windows.rv.map(value => value === '/zh/p/contract-beta/' ? href : value) }),
            })),
        ]) {
            globalThis.fetch = async () => response;
            assert.equal((await breadcrumbSource.loadBreadcrumbColumns([unloaded]))[0].status, 'rejected');
            assert.equal(breadcrumbSource.readBreadcrumbColumn('/discover/windows/').payload, null);
        }
        window.location.hash = '#from=discover/windows&sorts=name-asc,date-desc';
        globalThis.fetch = async () => ({ ok: true, json: async () => ({
            ...payloads.windows, rv: payloads.windows.rv.map(value => value === 'Beta' ? 'Updated Beta' : value),
        }) });
        assert.equal((await breadcrumbSource.loadBreadcrumbColumns(breadcrumbSource.readBreadcrumbColumns()))[1].status, 'fulfilled',
            'a new fragment state must permit a failed resource to retry');
        assert.equal(breadcrumbSource.readBreadcrumbColumn('/discover/windows/').payload.rows[1].text, 'Updated Beta');
        assert.equal(loaded[1].payload.rows[1].text, 'Beta', 'new resource data must not overwrite an older decoded payload');

        let unexpectedRequests = 0;
        globalThis.fetch = async () => { unexpectedRequests++; throw new Error('Unexpected request'); };
        for (const url of ['https://outside.test/column.json', 'blob:https://example.test/resource']) {
            assert.equal((await breadcrumbSource.loadBreadcrumbColumns([{ ...unloaded, url }]))[0].status, 'rejected');
        }
        assert.equal((await breadcrumbSource.loadBreadcrumbColumns([{ key: '/missing/', url: '' }]))[0].status, 'rejected');
        assert.equal(unexpectedRequests, 0, 'invalid and cross-origin references must fail before fetching');
        const invalidHash = structuredClone(manifest);
        invalidHash.columns['/discover/windows/'] = 'not-a-hash';
        document.body.dataset.navigation = JSON.stringify(invalidHash);
        assert.equal(breadcrumbSource.readBreadcrumbColumn('/discover/windows/').url, '');

        const previousSetTimeout = globalThis.setTimeout;
        const previousClearTimeout = globalThis.clearTimeout;
        let abortRequest, cleared = false;
        globalThis.setTimeout = (callback, delay) => {
            assert.equal(delay, 8000, 'a navigation request must have a bounded wait');
            abortRequest = callback;
            return 1;
        };
        globalThis.clearTimeout = () => { cleared = true; };
        globalThis.fetch = (_, { signal }) => new Promise((_, reject) => {
            signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
        });
        try {
            const timed = breadcrumbSource.loadBreadcrumbColumns([{ key: '/timeout/',
                url: manifest.resources + 'e'.repeat(64) + '.json' }]);
            abortRequest();
            assert.equal((await timed)[0].status, 'rejected', 'a stalled request must abort instead of hanging navigation');
            assert.equal(cleared, true);
        } finally {
            globalThis.setTimeout = previousSetTimeout;
            globalThis.clearTimeout = previousClearTimeout;
        }
        globalThis.fetch = async () => { unexpectedRequests++; throw new Error('Unexpected request'); };

        const roots = ['/zh/notes/', '/zh/discover/', '/zh/all/'].map(href => {
            const link = { dataset: { rootHref: href }, attributes: {}, current: false };
            link.classList = { toggle: (_, current) => { link.current = current; } };
            link.setAttribute = (name, value) => { link.attributes[name] = value; };
            link.removeAttribute = name => { delete link.attributes[name]; };
            return link;
        });
        document.querySelector = () => ({ dataset: { defaultRootHref: '/zh/notes/' }, querySelectorAll: () => roots });
        window.location.hash = '#from=discover/windows';
        rootController.refreshRootSelection();
        assert.deepEqual(roots.filter(root => root.current).map(root => root.dataset.rootHref), ['/zh/discover/']);
        assert.equal(roots.find(root => root.current).attributes['aria-current'], 'page');
        window.location.hash = '#from=unregistered';
        rootController.refreshRootSelection();
        assert.deepEqual(roots.filter(root => root.current).map(root => root.dataset.rootHref), ['/zh/notes/']);
        rootController.renderRootSelection('/zh/all/');
        assert.deepEqual(roots.filter(root => root.current).map(root => root.dataset.rootHref), ['/zh/all/']);
        assert.equal(unexpectedRequests, 0, 'root selection must work without requesting or decoding row data');

        const pending = new Map([['data-entry-breadcrumb-pending', 'true'], ['data-breadcrumb-sort-pending', 'true']]);
        document.documentElement = { getAttribute: name => pending.get(name), removeAttribute: name => pending.delete(name) };
        document.querySelector = () => null;
        await breadcrumbPath.initializeBreadcrumb();
        assert.equal(pending.size, 0, 'a page without a path container must clear pending flags');
    } finally {
        globalThis.fetch = previousFetch;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }

    const logicSources = path.join(tempRoot, 'entry-logic-sources');
    await fs.cp(jsRoot, logicSources, { recursive: true });
    await fs.writeFile(path.join(logicSources, 'browse/path-render.js'),
        'export function renderPathColumns(models){globalThis.navigationEntryTest.renders.push(models);return true;}');
    await fs.writeFile(path.join(logicSources, 'browse/breadcrumb-column-sort.js'),
        'export function refreshBreadcrumbCollectionColumns(){}');
    await fs.writeFile(path.join(logicSources, 'browse/collection-navigation.js'),
        'export function refreshMainCollectionNavigation(){globalThis.navigationEntryTest.mainRefreshes++;}');
    const logicBundles = await buildJavaScript({ jsRoot: logicSources, work: path.join(tempRoot, 'entry-logic'),
        entries: ['browse/breadcrumb-entry.js'] });
    const entryLogic = await import(pathToFileURL(logicBundles.get('browse/breadcrumb-entry.js').file).href);
    const savedLocation = window.location;
    const savedHistory = window.history;
    const pending = new Map();
    const writes = [];
    const setLocation = href => {
        const url = new URL(href, window.location.origin);
        window.location = { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash };
    };
    const startPending = () => pending.set('data-entry-breadcrumb-pending', 'true');
    globalThis.navigationEntryTest = { renders: [], mainRefreshes: 0 };
    globalThis.document = {
        body: { dataset: { navigation: JSON.stringify(manifest) } },
        documentElement: { getAttribute: name => pending.get(name), removeAttribute: name => pending.delete(name) },
        querySelector: selector => selector === '[data-slot="breadcrumb"]' ? {} : null,
    };
    window.history = { state: {}, replaceState: (_, __, href) => { writes.push(href); setLocation(href); } };
    try {
        const requests = [];
        globalThis.fetch = async url => {
            requests.push(url);
            return { ok: true, json: async () => url.includes(hashes.notes) ? payloads.notes : payloads.discover };
        };
        setLocation('https://example.test/zh/p/contract-beta/?keep=%2f+value#from=discover&sort=name-desc&sorts=date-asc&anchor=chapter');
        startPending();
        await entryLogic.initializeBreadcrumb();
        assert.equal(fragment.readFieldValue(window.location.hash, 'from'), '',
            'a loaded terminal column without the current article must clear only the invalid source');
        assert.equal(window.location.search, '?keep=%2f+value');
        assert.equal(fragment.readFieldValue(window.location.hash, 'sort'), 'name-desc');
        assert.equal(fragment.readFieldValue(window.location.hash, 'sorts'), 'date-asc');
        assert.equal(fragment.readAnchor(window.location.hash), 'chapter');
        assert.deepEqual(navigationEntryTest.renders.at(-1).map(model => model.key), ['/notes/']);
        assert.equal(navigationEntryTest.mainRefreshes, 1, 'clearing invalid from must refresh main-list navigation');
        assert.equal(requests.length, 2, 'invalid membership must load the default columns after verification');
        assert.equal(pending.size, 0);

        setLocation('https://example.test/zh/p/contract-beta/#from=missing&anchor=chapter');
        startPending();
        await entryLogic.initializeBreadcrumb();
        assert.equal(fragment.readFieldValue(window.location.hash, 'from'), '',
            'a missing terminal hash must also clear the invalid source');
        assert.equal(fragment.readAnchor(window.location.hash), 'chapter');

        const unavailable = structuredClone(manifest);
        unavailable.columns['/discover/'] = '1'.repeat(64);
        document.body.dataset.navigation = JSON.stringify(unavailable);
        const beforeFailure = writes.length;
        globalThis.fetch = async () => ({ ok: false });
        setLocation('https://example.test/zh/p/contract-beta/#from=discover');
        startPending();
        await entryLogic.initializeBreadcrumb();
        assert.equal(writes.length, beforeFailure, 'a network failure must not be treated as invalid membership');
        assert.equal(fragment.readFieldValue(window.location.hash, 'from'), 'discover');
        assert.equal(navigationEntryTest.renders.at(-1)[0].failed, true);
        assert.equal(pending.size, 0);

        const own = structuredClone(manifest);
        own.default = '/discover/';
        delete own.columns['/discover/windows/'];
        document.body.dataset.navigation = JSON.stringify(own);
        document.body.dataset.collectionPath = '/discover/windows/';
        const beforeOwn = writes.length;
        globalThis.fetch = async () => { throw new Error('Own main list must not require its missing resource'); };
        setLocation('https://example.test/zh/discover/windows/#from=discover/windows');
        startPending();
        await entryLogic.initializeBreadcrumb();
        assert.equal(writes.length, beforeOwn, 'a collection own entry must not require membership in its own rows');
        assert.deepEqual(navigationEntryTest.renders.at(-1).map(model => model.key), ['/discover/']);

        delete own.columns['/discover/%E5%B7%A5%E5%85%B7/'];
        document.body.dataset.navigation = JSON.stringify(own);
        document.body.dataset.collectionPath = '/discover/%E5%B7%A5%E5%85%B7/';
        const beforeUnicodeOwn = writes.length;
        setLocation('https://example.test/zh/discover/%E5%B7%A5%E5%85%B7/#from=discover/%E5%B7%A5%E5%85%B7');
        startPending();
        await entryLogic.initializeBreadcrumb();
        assert.equal(writes.length, beforeUnicodeOwn, 'encoded Unicode own-entry paths must not be cleared');

        const race = structuredClone(manifest);
        race.columns['/discover/'] = '3'.repeat(64);
        race.columns['/discover/windows/'] = '2'.repeat(64);
        document.body.dataset.navigation = JSON.stringify(race);
        delete document.body.dataset.collectionPath;
        let releaseRace;
        const raceGate = new Promise(resolve => { releaseRace = resolve; });
        globalThis.fetch = async url => {
            if (url.includes('2'.repeat(64))) await raceGate;
            return { ok: true, json: async () => url.includes('2'.repeat(64)) ? payloads.windows : payloads.discover };
        };
        setLocation('https://example.test/zh/p/contract-beta/#from=discover/windows');
        startPending();
        const oldRequest = entryLogic.initializeBreadcrumb();
        try {
            setLocation('https://example.test/zh/p/contract-beta/#from=notes');
            startPending();
            await entryLogic.initializeBreadcrumb();
            assert.deepEqual(navigationEntryTest.renders.at(-1).map(model => model.key), ['/notes/']);
        } finally {
            releaseRace();
        }
        const renders = navigationEntryTest.renders.length;
        assert.equal((await oldRequest).stale, true, 'an older request must not validate or render a newer source');
        assert.equal(navigationEntryTest.renders.length, renders);
        assert.equal(fragment.readFieldValue(window.location.hash, 'from'), 'notes');
        assert.equal(pending.size, 0);
    } finally {
        globalThis.fetch = previousFetch;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        window.location = savedLocation;
        window.history = savedHistory;
        delete globalThis.navigationEntryTest;
    }

    console.log('Entry route checks passed.');
} finally {
    await fs.rm(tempRoot,{recursive:true,force:true});
}
