import { readActiveNavigationRoute } from '../browse/navigation-source.js';

try {
    const nav = document.querySelector('[data-slot="breadcrumb"]');
    if (nav) {
        const route = readActiveNavigationRoute();
        if (route.columns.length === 0) {
            document.documentElement.removeAttribute('data-breadcrumb-pending');
            nav.removeAttribute('aria-hidden');
        } else {
            const columns = document.createDocumentFragment();
            for (const column of route.columns) {
                const placeholder = document.createElement('div');
                placeholder.className = 'page-column breadcrumb-column';
                placeholder.dataset.breadcrumbColumn = 'true';
                placeholder.dataset.breadcrumbColumnPath = column.column;
                columns.appendChild(placeholder);
            }
            nav.replaceChildren(columns);
        }
    }
} catch (_) { }
