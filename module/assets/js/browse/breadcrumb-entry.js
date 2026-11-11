import { initializeBreadcrumbNavigation } from './breadcrumb-controller.js';
import { initBreadcrumbSort, refreshBreadcrumbColumns } from './breadcrumb-sort.js';
import { normalizeFromPath, readCurrentFromPath } from './navigation-state.js';
import { readFieldValue } from './navigation-state.contract.js';

initializeBreadcrumbNavigation();
initBreadcrumbSort();
window.addEventListener('banyan:sortschange', () => refreshBreadcrumbColumns());

window.addEventListener('hashchange', async (event) => {
    const previous = new URL(event.oldURL);
    const from = normalizeFromPath(readFieldValue(previous, 'from'));
    const sorts = readFieldValue(previous, 'sorts');
    const nextFrom = readCurrentFromPath();
    const nextSorts = readFieldValue(location.hash, 'sorts');
    if (from === nextFrom && sorts === nextSorts) return;
    if (from !== nextFrom) {
        document.documentElement.setAttribute('data-breadcrumb-pending', 'true');
    }
    await initializeBreadcrumbNavigation();
});
