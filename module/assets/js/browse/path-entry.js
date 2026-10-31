import { initializeBreadcrumb } from './breadcrumb-entry.js';
import { initBreadcrumbColumnSort } from './breadcrumb-column-sort.js';
import { normalizeFromPath, readCurrentFromPath } from './navigation-state.js';
import { readFieldValue } from './navigation-state.contract.js';

initializeBreadcrumb();
initBreadcrumbColumnSort();

window.addEventListener('hashchange', async (event) => {
    const previous = new URL(event.oldURL);
    const from = normalizeFromPath(readFieldValue(previous, 'from'));
    const sorts = readFieldValue(previous, 'sorts');
    const nextFrom = readCurrentFromPath();
    const nextSorts = readFieldValue(location.hash, 'sorts');
    if (from === nextFrom && sorts === nextSorts) return;
    if (from !== nextFrom) {
        document.documentElement.setAttribute('data-entry-breadcrumb-pending', 'true');
    }
    await initializeBreadcrumb();
});
