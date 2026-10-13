import {
    applyBreadcrumbRowSort,
    buildCollectionSortToggleHref,
    getCollectionSortState,
} from './breadcrumb-items.js';
import {
    createCollectionSourceIndex,
    readEntryBreadcrumbSources,
    pickCollectionItemsByHref,
    pickCollectionSourceByHref,
} from './breadcrumb-source.js';
import { updateCollectionColumnHeader } from './path-render.js';
import { sortItemsRows } from './collection-items.js';
import { refreshMainCollectionNavigation } from './collection-navigation.js';
import {
    getLogicalPathDepth,
    normalizePathname,
    readCurrentFromPath,
} from './navigation-state.js';
let cachedCollectionSourceIndex = null;
let cachedSources = null;

function readCollectionSourceIndex() {
    const sources = readEntryBreadcrumbSources();
    if (sources === cachedSources) {
        return cachedCollectionSourceIndex;
    }

    cachedCollectionSourceIndex = createCollectionSourceIndex(sources);
    cachedSources = sources;
    return cachedCollectionSourceIndex;
}

function readWrapperCollectionSource(wrapper, sourceIndex = readCollectionSourceIndex()) {
    if (!(wrapper instanceof HTMLElement)) {
        return null;
    }

    return pickCollectionSourceByHref(
        sourceIndex,
        wrapper.dataset.breadcrumbCollectionHref || ''
    );
}

function readWrapperCollectionItems(wrapper, sourceIndex = readCollectionSourceIndex()) {
    if (!(wrapper instanceof HTMLElement)) {
        return null;
    }

    return pickCollectionItemsByHref(
        sourceIndex,
        wrapper.dataset.breadcrumbCollectionHref || ''
    );
}

function readVisibleLineageLogicalPath(sourceIndex = readCollectionSourceIndex()) {
    const currentFromPath = readCurrentFromPath();
    if (currentFromPath) {
        return currentFromPath;
    }

    return Array.from(document.querySelectorAll('[data-slot="breadcrumb"] [data-collection-column]'))
        .map((wrapper) => readWrapperCollectionSource(wrapper, sourceIndex)?.logicalPath || '')
        .reduce((deepest, logicalPath) => (
            getLogicalPathDepth(logicalPath) > getLogicalPathDepth(deepest)
                ? logicalPath
                : deepest
        ), '');
}

function isPlainPrimaryClick(event, link) {
    return !event.defaultPrevented
        && event.button === 0
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.shiftKey
        && !link.hasAttribute('download')
        && (!link.target || link.target === '_self');
}

export function refreshBreadcrumbCollectionColumns(changedLogicalPath = '') {
    const wrappers = Array.from(document.querySelectorAll(
        '[data-slot="breadcrumb"] [data-collection-column]'
    ));
    if (wrappers.length === 0) {
        return;
    }

    const sourceIndex = readCollectionSourceIndex();
    const lineageLogicalPath = readVisibleLineageLogicalPath(sourceIndex);
    wrappers.forEach((wrapper) => {
        const collectionSource = readWrapperCollectionSource(wrapper, sourceIndex);
        if (!collectionSource?.logicalPath) {
            return;
        }
        if (changedLogicalPath && !collectionSource.logicalPath.startsWith(changedLogicalPath)) {
            return;
        }

        const decoded = readWrapperCollectionItems(wrapper, sourceIndex);
        const state = getCollectionSortState(collectionSource);
        const header = wrapper.querySelector('[data-list-header]');
        if (!decoded || !state || !header?.querySelector('[data-collection-sort-toggle]')) return;

        const links = [...wrapper.querySelectorAll('[data-list-item] > a[data-list-entry][href]')];
        const pathname = href => normalizePathname(new URL(href, window.location.origin).pathname);
        const elementsByPath = new Map(links.map(link => [pathname(link.href), link.parentElement]));
        const { rows } = sortItemsRows(decoded.rows, state.sortVariant, collectionSource.logicalPath, state.defaultSort);
        const rowElements = rows.map(row => elementsByPath.get(pathname(row.href)));
        if (rowElements.length !== links.length || rowElements.some(row => !row)) return;

        rows.forEach((row, i) => {
            const link = rowElements[i].querySelector('a[data-list-entry]');
            const url = new URL(link.href);
            // Preserve the existing from, fragment and unrelated query fields.
            applyBreadcrumbRowSort(url, row, collectionSource, state);
            const href = `${url.pathname}${url.search}${url.hash}`;
            if (link.getAttribute('href') !== href) link.setAttribute('href', href);
        });
        if (rowElements.some((row, i) => row !== links[i].parentElement)) {
            const scrollTop = wrapper.scrollTop;
            const fragment = document.createDocumentFragment();
            rowElements.forEach(row => fragment.appendChild(row));
            header.parentElement.appendChild(fragment);
            wrapper.scrollTop = scrollTop;
        }
        updateCollectionColumnHeader(header, collectionSource, state, lineageLogicalPath);
    });
}

export function initBreadcrumbColumnSort() {
    document.addEventListener('click', (event) => {
        const toggle = event.target instanceof Element
            ? event.target.closest(
                'a[data-collection-sort-toggle="true"]'
            )
            : null;
        if (!(toggle instanceof HTMLAnchorElement) || !isPlainPrimaryClick(event, toggle)) {
            return;
        }

        const wrapper = toggle.closest('[data-collection-column]');
        const sourceIndex = readCollectionSourceIndex();
        const collectionSource = readWrapperCollectionSource(wrapper, sourceIndex);
        if (!collectionSource?.logicalPath) {
            return;
        }

        const lineageLogicalPath = readVisibleLineageLogicalPath(sourceIndex)
            || collectionSource.logicalPath;
        const nextHref = buildCollectionSortToggleHref(
            collectionSource,
            window.location.href,
            lineageLogicalPath
        );
        if (!nextHref) {
            return;
        }

        event.preventDefault();
        window.history.replaceState(window.history.state, '', nextHref);
        refreshBreadcrumbCollectionColumns(collectionSource.logicalPath);
        refreshMainCollectionNavigation();
    });
}
