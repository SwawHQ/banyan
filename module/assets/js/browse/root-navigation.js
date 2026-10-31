import { readActiveNavigationRoute } from './entry-source.js';

export function renderRootSelection(rootHref) {
    const navigation = document.querySelector('[data-root-navigation]');
    if (!navigation) return;
    const href = rootHref || navigation.dataset.defaultRootHref || '';
    navigation.querySelectorAll('[data-root-href]').forEach((link) => {
        const current = link.dataset.rootHref === href;
        link.classList.toggle('is-current', current);
        if (current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

export function refreshRootSelection() {
    renderRootSelection(readActiveNavigationRoute().root);
}

export function initRootNavigation() {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) refreshRootSelection();
    });
    window.addEventListener('popstate', refreshRootSelection);
    window.addEventListener('hashchange', refreshRootSelection);
}
