import {
    applyBreadcrumbRowSort,
    buildCollectionPageHref,
    buildBreadcrumbSortToggleHref,
    getBreadcrumbSortState,
    readRequestedSortState,
} from './breadcrumb-links.js';
import { readBreadcrumbColumns, readBreadcrumbColumn } from './breadcrumb-source.js';
import { readActiveNavigationRoute } from './navigation-source.js';
import { renderBreadcrumbColumn, updateBreadcrumbColumnHeader } from './breadcrumb-render.js';
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

export function refreshBreadcrumbParentLinks() {
    const payloads = new Map(readBreadcrumbColumns().filter(column => column.payload).map(({ payload }) => [
        normalizePathname(new URL(payload.href, window.location.origin).pathname), payload,
    ]));
    document.querySelectorAll('[data-root-navigation] a[data-root-href], [data-slot="breadcrumb"] a[data-list-entry][href]').forEach(link => {
        // Root entries keep a native URL so leaving a lineage also clears its sort.
        const href = link.dataset.rootHref || link.getAttribute('href');
        const payload = payloads.get(normalizePathname(new URL(href, window.location.origin).pathname));
        if (!payload && !link.dataset.rootHref) return;
        const next = payload
            ? buildCollectionPageHref(href, payload.logicalPath, payload.sortVariant, payload.defaultSort) : href;
        if (link.getAttribute('href') !== next) link.setAttribute('href', next);
    });
}

export function refreshBreadcrumbColumns(changedLogicalPath = '') {
    const wrappers = [...document.querySelectorAll('[data-slot="breadcrumb"] [data-breadcrumb-column]')];
    const columns = readBreadcrumbColumns();
    const lineageLogicalPath = visibleLineage(columns);
    const changedIndex = columns.findIndex(column => column.key === changedLogicalPath);
    wrappers.forEach((wrapper, index) => {
        if (changedLogicalPath && index < changedIndex) return;
        const column = columns.find(item => item.key === wrapper.dataset.breadcrumbColumnPath);
        const payload = column?.payload;
        if (!payload) return;
        if (wrapper.hasAttribute('data-breadcrumb-failed')) {
            let selectedPathname = '';
            try { selectedPathname = normalizePathname(new URL(column.selected, window.location.origin).pathname); } catch (_) { }
            renderBreadcrumbColumn(wrapper, payload, { selectedPathname, lineageLogicalPath });
            return;
        }
        const state = getBreadcrumbSortState(payload);
        const linkState = state || readRequestedSortState(payload, '', '');
        const header = wrapper.querySelector('[data-list-header]');
        if (!header) return;
        const links = [...wrapper.querySelectorAll('[data-list-item] > a[data-list-entry][href]')];
        const pathname = href => normalizePathname(new URL(href, window.location.origin).pathname);
        const elementsByPath = new Map(links.map(link => [pathname(link.href), link.parentElement]));
        const rows = state && state.sortToken !== payload.defaultSort
            ? sortItemsRows(payload.rows, state.sortVariant, payload.logicalPath, state.defaultSort).rows : payload.rows;
        const rowElements = rows.map(row => elementsByPath.get(pathname(row.href)));
        if (rowElements.length !== links.length || rowElements.some(row => !row)) return;
        rows.forEach((row, i) => {
            const link = rowElements[i].querySelector('a[data-list-entry]');
            const url = new URL(link.href);
            // Preserve the existing from, fragment and unrelated query fields.
            applyBreadcrumbRowSort(url, row, payload, linkState);
            const href = `${url.pathname}${url.search}${url.hash}`;
            if (link.getAttribute('href') !== href) link.setAttribute('href', href);
            const current = pathname(row.href) === pathname(column.selected);
            link.classList.toggle('is-current', current);
            if (current) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        if (rowElements.some((row, i) => row !== links[i].parentElement)) {
            const scrollTop = wrapper.scrollTop;
            const focused = wrapper.contains(document.activeElement) ? document.activeElement : null;
            const fragment = document.createDocumentFragment();
            rowElements.forEach(row => fragment.appendChild(row));
            header.parentElement.appendChild(fragment);
            focused?.focus({ preventScroll: true });
            wrapper.scrollTop = scrollTop;
        }
        if (state) updateBreadcrumbColumnHeader(header, payload, state, lineageLogicalPath);
    });
    refreshBreadcrumbParentLinks();
}

export function initBreadcrumbSort() {
    document.addEventListener('click', event => {
        const toggle = event.target instanceof Element ? event.target.closest('a[data-breadcrumb-sort-toggle="true"]') : null;
        if (!(toggle instanceof HTMLAnchorElement) || !isPlainPrimaryClick(event, toggle)) return;
        const wrapper = toggle.closest('[data-breadcrumb-column]');
        const payload = readBreadcrumbColumn(wrapper?.dataset.breadcrumbColumnPath).payload;
        if (!payload) return;
        const nextHref = buildBreadcrumbSortToggleHref(payload, window.location.href, visibleLineage(readBreadcrumbColumns()) || payload.logicalPath);
        if (!nextHref) return;
        event.preventDefault();
        window.history.replaceState(window.history.state, '', nextHref);
        refreshBreadcrumbColumns(payload.logicalPath);
        refreshMainCollectionNavigation();
    });
}
