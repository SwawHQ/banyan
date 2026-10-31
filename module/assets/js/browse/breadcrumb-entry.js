import { buildPathColumnItems } from './breadcrumb-items.js';
import { normalizeFromPath, normalizePathname, applyFromPathToUrl, readCurrentFromPath } from './navigation-state.js';
import { loadBreadcrumbColumns, readBreadcrumbColumns, readBreadcrumbColumn } from './breadcrumb-source.js';
import { readNavigation, readActiveNavigationRoute } from './entry-source.js';
import { renderPathColumns } from './path-render.js';
import { refreshBreadcrumbCollectionColumns } from './breadcrumb-column-sort.js';
import { refreshRootSelection } from './root-navigation.js';
import { refreshMainCollectionNavigation } from './collection-navigation.js';

export function buildPathColumn(column) {
    let selectedPathname = '';
    try {
        selectedPathname = normalizePathname(new URL(column.selected, window.location.origin).pathname);
    } catch (_) { }
    return {
        key: column.key, source: column.source, failed: !column.payload,
        items: column.payload ? buildPathColumnItems(column.payload, column.source, { selectedPathname }) : [],
    };
}

let initialization = 0;

export async function initializeBreadcrumb() {
    const request = ++initialization;
    const html = document.documentElement;
    const entryPending = html.getAttribute('data-entry-breadcrumb-pending') === 'true';
    const sortPending = html.getAttribute('data-breadcrumb-sort-pending') === 'true';
    const result = { entryRendered: false, sortRendered: false };
    try {
        if (!document.querySelector('[data-slot="breadcrumb"]')) return result;
        const route = readActiveNavigationRoute();
        const requested = readCurrentFromPath();
        if (requested && !route.from && requested !== normalizeFromPath(document.body?.dataset.collectionPath)) {
            const url = new URL(window.location.href);
            applyFromPathToUrl(url, '');
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        }
        await loadBreadcrumbColumns(readBreadcrumbColumns());
        // A later source selection owns the DOM, even if this request finishes last.
        if (request !== initialization) return { ...result, stale: true };
        const terminal = route.from ? readBreadcrumbColumn(route.from).payload : null;
        const pathname = normalizePathname(window.location.pathname);
        const invalid = terminal && !terminal.rows.some(row => row.kind === 'page'
            && normalizePathname(new URL(row.href, window.location.origin).pathname) === pathname);
        if (invalid && readCurrentFromPath() === route.from) {
            const url = new URL(window.location.href);
            applyFromPathToUrl(url, '');
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
            await loadBreadcrumbColumns(readBreadcrumbColumns());
            if (request !== initialization) return { ...result, stale: true };
            refreshRootSelection();
        }
        if (entryPending || invalid) {
            result.entryRendered = renderPathColumns(readBreadcrumbColumns().map(buildPathColumn), readNavigation()?.error || '');
        }
        refreshBreadcrumbCollectionColumns();
        refreshMainCollectionNavigation();
        result.sortRendered = sortPending;
    } finally {
        if (request === initialization) {
            if (entryPending) html.removeAttribute('data-entry-breadcrumb-pending');
            if (sortPending) html.removeAttribute('data-breadcrumb-sort-pending');
        }
    }
    return result;
}
