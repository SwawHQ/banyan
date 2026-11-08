import { normalizePathname, applyFromPathToUrl, readCurrentFromPath } from './navigation-state.js';
import { loadBreadcrumbColumn, readBreadcrumbColumns, readBreadcrumbColumn } from './breadcrumb-source.js';
import { readNavigation, readActiveNavigationRoute } from './entry-source.js';
import { preparePathColumns, fillPathColumn } from './path-render.js';
import { refreshBreadcrumbCollectionColumns, refreshBreadcrumbParentLinks } from './breadcrumb-column-sort.js';
import { refreshRootSelection } from './root-navigation.js';
import { refreshMainCollectionNavigation } from './collection-navigation.js';

let initialization = 0;

export async function initializeBreadcrumb() {
    const request = ++initialization;
    const html = document.documentElement;
    const entryPending = html.getAttribute('data-entry-breadcrumb-pending') === 'true';
    const renderColumns = async () => {
        const columns = readBreadcrumbColumns();
        const slots = preparePathColumns(columns);
        const lineage = readActiveNavigationRoute().lineage;
        refreshBreadcrumbCollectionColumns();
        await Promise.allSettled(columns.map(async (column, index) => {
            try {
                await loadBreadcrumbColumn(column);
            } finally {
                if (request === initialization && !slots[index].querySelector('[data-list-header]')) {
                    fillPathColumn(slots[index], { ...column, ...readBreadcrumbColumn(column.key) }, readNavigation()?.error || '', lineage);
                    refreshBreadcrumbParentLinks();
                }
            }
        }));
    };
    try {
        if (!document.querySelector('[data-slot="breadcrumb"]')) return;
        const route = readActiveNavigationRoute();
        const requested = readCurrentFromPath();
        if (requested && !route.from) {
            const url = new URL(window.location.href);
            applyFromPathToUrl(url, '');
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        }
        await renderColumns();
        // A later source selection owns the DOM, even if this request finishes last.
        if (request !== initialization) return;
        const terminal = route.from ? readBreadcrumbColumn(route.from).payload : null;
        const pathname = normalizePathname(window.location.pathname);
        const invalid = terminal && !terminal.rows.some(row => row.kind === 'page'
            && normalizePathname(new URL(row.href, window.location.origin).pathname) === pathname);
        if (invalid && readCurrentFromPath() === route.from) {
            const url = new URL(window.location.href);
            applyFromPathToUrl(url, '');
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
            await renderColumns();
            if (request !== initialization) return;
            refreshRootSelection();
        }
        refreshMainCollectionNavigation();
    } finally {
        if (request === initialization && entryPending) html.removeAttribute('data-entry-breadcrumb-pending');
    }
}
