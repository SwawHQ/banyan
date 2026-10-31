import { readActiveNavigationRoute } from '../browse/entry-source.js';

try {
    const nav = document.querySelector('[data-slot="breadcrumb"]');
    if (nav) {
        const route = readActiveNavigationRoute();
        if (route.columns.length === 0) {
            document.documentElement.removeAttribute('data-entry-breadcrumb-pending');
            nav.removeAttribute('aria-hidden');
        } else {
            const columns = document.createDocumentFragment();
            for (const column of route.columns) {
                const placeholder = document.createElement('div');
                placeholder.className = 'page-column path-column';
                placeholder.dataset.collectionColumn = 'true';
                placeholder.dataset.navigationColumn = column.column;
                columns.appendChild(placeholder);
            }
            nav.replaceChildren(columns);
        }
    }
} catch (_) { }
