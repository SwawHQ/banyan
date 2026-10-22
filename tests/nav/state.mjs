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
const collectionItemsEntry = path.join(browseRoot, 'collection-items.js');
const collectionSortEntry = path.join(browseRoot, 'collection-sort.js');
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'banyan-nav-state-'));

try {

    const entries = [navStateEntry, fragmentEntry, breadcrumbItemsEntry, breadcrumbEntry, breadcrumbSourceEntry, entrySourceEntry, rootNavigationEntry, collectionItemsEntry, collectionSortEntry];
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
            'https://example.test/zh/p/example/#from=tools/first-party',
            ['', 'name-asc'],
            ['date-desc', 'name-asc']
        ),
        '/zh/p/example/#from=tools/first-party',
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
    assert.deepEqual(breadcrumbSource.parseEntryBreadcrumbSources(JSON.stringify([{
        logical_path: '/discover/windows/', root_item: {text: 'Discover', href: '/discover/'}
    }])), [], 'browser payloads must use the current field names');

    const compositeRows = [
        {
            key: 'beta',
            href: '/zh/p/beta/',
            sort_group: '0',
            sort_name: 'Beta',
            sort_size: '2',
        },
        {
            key: 'alpha',
            href: '/zh/p/alpha/',
            sort_group: '0',
            sort_name: 'Alpha',
            sort_size: '2',
        },
        {
            key: 'gamma',
            href: '/zh/p/gamma/',
            sort_group: '0',
            sort_name: 'Gamma',
            sort_size: '10',
        },
    ];

    function readCompositeOrder(token, rows = compositeRows) {
        window.location.hash = `#sort=${token}`;
        window.location.href = `https://example.test/zh/all/${window.location.hash}`;
        return collectionItems.sortItemsRows(rows, 'all').rows.map((row) => row.key);
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
            key: 'second',
            href: '/zh/p/second/',
            sort_group: '0',
            sort_name: 'Same',
            sort_size: '2',
        },
        {
            key: 'first',
            href: '/zh/p/first/',
            sort_group: '0',
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
            key: 'same-day-later',
            href: '/zh/p/same-day-later/',
            sort_group: '0',
            sort_name: 'Same day later',
            sort_date: '20260726134731',
        },
        {
            key: 'next-day',
            href: '/zh/p/next-day/',
            sort_group: '0',
            sort_name: 'Next day',
            sort_date: '20260727000000',
        },
        {
            key: 'same-day-earlier',
            href: '/zh/p/same-day-earlier/',
            sort_group: '0',
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

    assert.deepEqual(
        breadcrumbPath.buildCurrentPathColumn(
            {},
            'Beta',
            'Beta detailed article title',
            '/zh/p/contract-beta/#from=discover/windows'
        ),
        {
            source: null,
            items: [{
                text: 'Beta',
                title: 'Beta detailed article title',
                href: '/zh/p/contract-beta/#from=discover/windows',
                current: true,
            }],
        },
        'entry preview should keep compact visible text and the full title as separate fields'
    );

    const previewColumn = breadcrumbPath.buildCurrentPathColumn(
        {
            currentColumn: {source: {
                logicalPath: '/discover/windows/',
                provider: 'collection',
                sortVariant: 'section',
                defaultSort: 'date-desc',
            },
            payload: collectionItems.decodeItemsPayload({
                ds: 'date-desc',
                f: ['key', 'kind', 'href', 'text', 'sort_group', 'sort_name', 'sort_date', 'sort_count'],
                lp: '/discover/windows/',
                p: 'collection',
                rv: [
                    'contract-beta', 'page', '/zh/p/contract-beta/', 'Beta', '1', 'Beta', '20260624', '1341',
                ],
                sv: 'section',
                v: 1,
            })},
        },
        'Beta',
        'Beta detailed article title',
        '/zh/p/contract-beta/#from=discover/windows'
    );

    assert.equal(
        previewColumn?.items?.find((item) => item.current === true)?.title,
        'Beta detailed article title',
        'entry preview should attach the full title to the visible current column item'
    );

    const sourcePayload = JSON.stringify([{
        logicalPath: '/discover/windows/',
        rootItem: {
            href: '/zh/discover/',
            text: 'Discover',
            title: 'Article topics'
        },
        currentColumn: {source: {
            logicalPath: '/discover/windows/',
            provider: 'collection',
            sortVariant: 'section',
            defaultSort: 'date-desc',
            label: 'Windows',
            href: '/zh/discover/windows/'
        },
        payload: {
            ds: 'date-desc',
            f: ['key', 'kind', 'href', 'text', 'sort_group', 'sort_name', 'sort_date', 'sort_count'],
            lp: '/discover/windows/',
            p: 'collection',
            rv: [
                'contract-alpha', 'page', '/zh/p/contract-alpha/', 'Alpha', '1', 'Alpha', '20260626', '6402',
                'contract-beta', 'page', '/zh/p/contract-beta/', 'Beta', '1', 'Beta', '20260624', '1341',
            ],
            sv: 'section',
            v: 1
        }},
        columns: [{
            selected: {
                href: '/zh/discover/windows/',
                text: 'Windows',
                title: 'Windows development'
            },
            source: {
                logicalPath: '/discover/',
                provider: 'collection',
                sortVariant: 'section',
                defaultSort: 'date-desc',
                label: 'Discover',
                href: '/zh/discover/'
            },
            payload: {
                ds: 'date-desc',
                f: ['key', 'kind', 'href', 'text', 'sort_group', 'sort_name', 'sort_date', 'sort_count'],
                lp: '/discover/',
                p: 'collection',
                rv: ['windows', 'section', '/zh/discover/windows/', 'Windows', '0', 'Windows', '20260626', '2'],
                sv: 'section',
                v: 1,
            },
        }]
    }]);
    const sources = breadcrumbSource.parseEntryBreadcrumbSources(sourcePayload);
    const fallbackSources = JSON.parse(sourcePayload);
    fallbackSources[0].columns.push({
        selected: {text: 'Information', href: '/zh/about/'},
        source: {href: '/zh/about/', label: 'Information'},
        items: [{text: 'Information', href: '/zh/about/'}],
    });
    const fallbackColumn = breadcrumbSource.parseEntryBreadcrumbSources(JSON.stringify(fallbackSources))[0].columns.at(-1);
    assert.deepEqual(fallbackColumn.source, {href: '/zh/about/', label: 'Information'},
        'a plain path column must retain its header source');
    assert.deepEqual(fallbackColumn.items, [{text: 'Information', href: '/zh/about/'}],
        'a plain path column must retain its link items without a collection payload');

    const previousDocument = globalThis.document;
    globalThis.document = {body: {dataset: {entryBreadcrumbSources: sourcePayload}}};
    try {
        const readers = [entrySource.readEntrySources, breadcrumbSource.readEntryBreadcrumbSources];
        const cached = readers.map(read => read());
        for (const [index, read] of readers.entries()) {
            assert.equal(read(), cached[index], 'unchanged source data must reuse its parsed array');
        }
        const changedSources = JSON.parse(sourcePayload);
        changedSources[0].rootItem.text = 'Updated directories';
        document.body.dataset.entryBreadcrumbSources = JSON.stringify(changedSources);
        for (const [index, read] of readers.entries()) {
            const changed = read();
            assert.notEqual(changed, cached[index], 'changed source data must refresh its parsed array');
            assert.equal(changed[0].rootItem.text, 'Updated directories');
            assert.equal(cached[index][0].rootItem.text, 'Discover', 'refresh must not change the previous parsed data');
        }
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }

    const invalidPayloadSources = JSON.parse(sourcePayload);
    invalidPayloadSources[0].currentColumn.payload = {v: 1};
    invalidPayloadSources[0].columns[0].payload = {v: 1};
    const metadataSources = entrySource.parseEntrySources(JSON.stringify(invalidPayloadSources));
    assert.equal(entrySource.parseEntrySelection(metadataSources, '/discover/windows/')?.source?.rootItem?.href,
        '/zh/discover/', 'root selection must use source metadata even when collection payloads are invalid');
    assert.equal(entrySource.pickSourceByLogicalPath(metadataSources, '/discover/windows/'), metadataSources[0],
        'source metadata lookup must use the exact logical path');
    assert.equal(entrySource.parseEntrySelection(metadataSources, '/discover/unknown/'), null,
        'invalid collection payloads must not allow unregistered source paths');
    assert.deepEqual(entrySource.parseEntrySources('{'), [], 'malformed source JSON must not throw');

    assert.deepEqual(
        {
            rootText: sources[0]?.rootItem?.text,
            rootTitle: sources[0]?.rootItem?.title,
            branchText: sources[0]?.columns?.[0]?.selected?.text,
            branchTitle: sources[0]?.columns?.[0]?.selected?.title,
        },
        {
            rootText: 'Discover',
            rootTitle: 'Article topics',
            branchText: 'Windows',
            branchTitle: 'Windows development',
        },
        'directory root and branch navigation should preserve compact text separately from full semantic titles'
    );

    assert.deepEqual(
        entrySource.parseEntrySelection(sources, '/discover/windows/'),
        {
            source: sources[0],
        },
        'short from should select the collection source without requiring an entry key tail'
    );

    assert.equal(
        entrySource.parseEntrySelection(sources, '/discover/windows/contract-beta/'),
        null,
        'from values with an entry key tail should not be treated as valid navigation state'
    );

    for (const invalidFrom of ['/discover/', '/discover/unknown/', '/tools/windows/', '']) {
        assert.equal(
            entrySource.parseEntrySelection(sources, invalidFrom),
            null,
            'root selection must use an exact published source, never infer a root from an unregistered prefix'
        );
    }

    const collectionSourceIndex = breadcrumbSource.createCollectionSourceIndex(sources);
    assert.deepEqual(
        breadcrumbSource.pickCollectionSourceByHref(
            collectionSourceIndex,
            'https://example.test/zh/discover/#sort=date-asc&anchor=menu'
        ),
        {
            logicalPath: '/discover/',
            provider: 'collection',
            sortVariant: 'section',
            defaultSort: 'date-desc',
            label: 'Discover',
            href: '/zh/discover/',
        },
        'collection href lookup should resolve ancestor metadata from the current page source registry'
    );
    assert.deepEqual(
        breadcrumbSource.pickCollectionSourceByHref(
            collectionSourceIndex,
            '/zh/discover/windows'
        ),
        {
            logicalPath: '/discover/windows/',
            provider: 'collection',
            sortVariant: 'section',
            defaultSort: 'date-desc',
            label: 'Windows',
            href: '/zh/discover/windows/',
        },
        'collection href lookup should normalize trailing slashes and resolve the current collection'
    );
    assert.equal(
        breadcrumbSource.pickCollectionSourceByHref(collectionSourceIndex, '/zh/unknown/'),
        null,
        'collection href lookup must not infer metadata for sources absent from the current page registry'
    );

    assert.equal(
        breadcrumbItems.buildBreadcrumbRowHref(
            {
                key: 'contract-beta',
                kind: 'page',
                href: '/zh/p/contract-beta/',
                text: '紧凑标题',
            },
            {
                logicalPath: '/discover/windows/',
                provider: 'collection',
            },
            {
                sortToken: '',
                defaultSort: 'date-desc',
                sortsTokens: [],
                defaultSortsTokens: ['date-desc', 'date-desc'],
            }
        ),
        '/zh/p/contract-beta/#from=discover/windows',
        'entry hrefs should write collection-only from values'
    );

    const selectedColumn = breadcrumbItems.buildSelectedPathColumn(
        sources[0],
        '/zh/p/contract-beta/',
        'Beta detailed article title'
    );
    const selectedItem = selectedColumn?.items?.find((item) => item.current === true);

    assert.equal(
        selectedItem?.text,
        'Beta',
        'short from should resolve the compact visible text from the selected row'
    );
    assert.equal(selectedItem?.current, true, 'selected row from pathname should be marked current');
    assert.equal(
        selectedItem?.title,
        'Beta detailed article title',
        'selected current item should preserve the full page title without expanding the compact collection payload'
    );
    assert.equal(
        selectedColumn?.items?.find((item) => item.text === 'Beta')?.current,
        true,
        'current breadcrumb column item should be highlighted when selected by pathname'
    );
    assert.equal(
        selectedColumn?.items?.find((item) => item.current === true)?.title,
        'Beta detailed article title',
        'settled entry state should attach the full title to the visible current column item'
    );
    assert.equal(selectedColumn?.source?.logicalPath, '/discover/windows/',
        'column source metadata must stay separate from its link items');
    assert.equal(selectedColumn.items.filter((item) => item.current === true).length, 1,
        'a selected column must mark one current row');
    assert.ok(selectedColumn.items.every((item) => !('column_items' in item) && !('collection_source' in item)),
        'path items must not contain column metadata or nested rows');

    console.log('Entry from checks passed.');
} finally {
    await fs.rm(tempRoot,{recursive:true,force:true});
}
