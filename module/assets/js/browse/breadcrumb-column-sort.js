import {
    applyBreadcrumbRowSort,
    buildCollectionSortToggleHref,
    buildPathColumnItems,
    getCollectionSortState,
} from './breadcrumb-items.js';
import { readBreadcrumbColumns, readBreadcrumbColumn } from './breadcrumb-source.js';
import { readActiveNavigationRoute } from './entry-source.js';
import { renderPathColumn, updateCollectionColumnHeader } from './path-render.js';
import { sortItemsRows } from './collection-items.js';
import { refreshMainCollectionNavigation } from './collection-navigation.js';
import { normalizePathname } from './navigation-state.js';

function visibleLineage(columns) {
    return readActiveNavigationRoute().lineage || columns.at(-1)?.key || '';
}

function isPlainPrimaryClick(event, link) {
    return !event.defaultPrevented && event.button === 0
        && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && !link.hasAttribute('download') && (!link.target || link.target === '_self');
}

export function refreshBreadcrumbCollectionColumns(changedLogicalPath = '') {
    const wrappers = [...document.querySelectorAll('[data-slot="breadcrumb"] [data-collection-column]')];
    if (!wrappers.length) return;
    const columns = readBreadcrumbColumns();
    const lineageLogicalPath = visibleLineage(columns);
    const changedIndex = columns.findIndex(column => column.key === changedLogicalPath);
    wrappers.forEach((wrapper, index) => {
        if (changedLogicalPath && index < changedIndex) return;
        const column = columns.find(item => item.key === wrapper.dataset.navigationColumn);
        const decoded = column?.payload;
        const source = column?.source;
        if (!decoded || !source) return;
        if (wrapper.hasAttribute('data-navigation-failed')) {
            let selectedPathname = '';
            try { selectedPathname = normalizePathname(new URL(column.selected, window.location.origin).pathname); } catch (_) { }
            renderPathColumn(wrapper, buildPathColumnItems(decoded, source, { selectedPathname }), source, { lineageLogicalPath });
        }
        const state = getCollectionSortState(source);
        const header = wrapper.querySelector('[data-list-header]');
        if (!state || !header?.querySelector('[data-collection-sort-toggle]')) return;
        const links = [...wrapper.querySelectorAll('[data-list-item] > a[data-list-entry][href]')];
        const pathname = href => normalizePathname(new URL(href, window.location.origin).pathname);
        const elementsByPath = new Map(links.map(link => [pathname(link.href), link.parentElement]));
        const { rows } = sortItemsRows(decoded.rows, state.sortVariant, source.logicalPath, state.defaultSort);
        const rowElements = rows.map(row => elementsByPath.get(pathname(row.href)));
        if (rowElements.length !== links.length || rowElements.some(row => !row)) return;
        rows.forEach((row, i) => {
            const link = rowElements[i].querySelector('a[data-list-entry]');
            const url = new URL(link.href);
            // Preserve the existing from, fragment and unrelated query fields.
            applyBreadcrumbRowSort(url, row, source, state);
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
        updateCollectionColumnHeader(header, source, state, lineageLogicalPath);
    });
}

export function initBreadcrumbColumnSort() {
    document.addEventListener('click', event => {
        const toggle = event.target instanceof Element ? event.target.closest('a[data-collection-sort-toggle="true"]') : null;
        if (!(toggle instanceof HTMLAnchorElement) || !isPlainPrimaryClick(event, toggle)) return;
        const wrapper = toggle.closest('[data-collection-column]');
        const source = readBreadcrumbColumn(wrapper?.dataset.navigationColumn).source;
        if (!source) return;
        const nextHref = buildCollectionSortToggleHref(source, window.location.href, visibleLineage(readBreadcrumbColumns()) || source.logicalPath);
        if (!nextHref) return;
        event.preventDefault();
        window.history.replaceState(window.history.state, '', nextHref);
        refreshBreadcrumbCollectionColumns(source.logicalPath);
        refreshMainCollectionNavigation();
    });
}
