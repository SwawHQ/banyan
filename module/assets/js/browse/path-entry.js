import { initializeBreadcrumb } from './breadcrumb-entry.js';
import { initBreadcrumbColumnSort, refreshBreadcrumbCollectionColumns } from './breadcrumb-column-sort.js';
import { normalizeFromPath, readCurrentFromPath } from './navigation-state.js';
import { readFieldValue } from './navigation-state.contract.js';
import { initAutoScrollbar } from './auto-scrollbar.js';

initializeBreadcrumb();
initBreadcrumbColumnSort();

window.addEventListener('hashchange', (event) => {
    const previous = new URL(event.oldURL);
    const from = normalizeFromPath(readFieldValue(previous, 'from'));
    const sorts = readFieldValue(previous, 'sorts');
    const nextFrom = readCurrentFromPath();
    const nextSorts = readFieldValue(location.hash, 'sorts');
    if (from === nextFrom && sorts === nextSorts) return;
    if (from !== nextFrom) {
        document.documentElement.setAttribute('data-entry-breadcrumb-pending', 'true');
        const { entryRendered } = initializeBreadcrumb();
        const nav = document.querySelector('[data-slot="breadcrumb"]');
        if (!entryRendered && nav?.defaultPath) {
            nav.replaceChildren(...nav.defaultPath.cloneNode(true).childNodes);
            nav.removeAttribute('aria-hidden');
            nav.querySelectorAll('.path-column').forEach(initAutoScrollbar);
        }
    }
    refreshBreadcrumbCollectionColumns();
});
