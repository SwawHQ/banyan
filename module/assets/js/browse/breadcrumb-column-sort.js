import {
    applyBreadcrumbRowSort,
    buildCollectionSortToggleHref,
    getCollectionSortState,
} from './breadcrumb-items.js';
import {
    parseCollectionSourceIndex,
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

function readCollectionSourceIndex() {
    if (cachedCollectionSourceIndex instanceof Map) {
        return cachedCollectionSourceIndex;
    }

    cachedCollectionSourceIndex = parseCollectionSourceIndex(
        document.body?.dataset.entryBreadcrumbSources || ''
    );
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

    return Array.from(document.querySelectorAll('.slot-breadcrumb [data-collection-column]'))
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
        '.slot-breadcrumb [data-collection-column]'
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
        const header = wrapper.querySelector('[data-collection-header]');
        if (!decoded || !state || !header?.querySelector('[data-collection-sort-toggle]')) return;

        const links = [...wrapper.querySelectorAll('a[data-collection-entry][href]')];
        const pathname = href => normalizePathname(new URL(href, window.location.origin).pathname);
        const cellsByPath = new Map(links.map(link => [pathname(link.href), link.parentElement]));
        const { rows } = sortItemsRows(decoded.rows, state.sortVariant, collectionSource.logicalPath, state.defaultSort);
        const cells = rows.map(row => cellsByPath.get(pathname(row.href)));
        if (cells.length !== links.length || cells.some(cell => !cell)) return;

        rows.forEach((row, i) => {
            const link = cells[i].querySelector('a[data-collection-entry]');
            const url = new URL(link.href);
            // Preserve the existing from, fragment and unrelated query fields.
            applyBreadcrumbRowSort(url, row, collectionSource, state);
            const href = `${url.pathname}${url.search}${url.hash}`;
            if (link.getAttribute('href') !== href) link.setAttribute('href', href);
        });
        if (cells.some((cell, i) => cell !== links[i].parentElement)) {
            const scrollTop = wrapper.scrollTop;
            const fragment = document.createDocumentFragment();
            cells.forEach(cell => fragment.appendChild(cell));
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
