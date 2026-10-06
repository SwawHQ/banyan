// Only a same-tab document link can opt into an already installed update.
export function initUpdateNavigation(runtime) {
    let navigationId = 0;
    let navigating = false;
    const cancelNavigation = () => { navigationId++; navigating = false; };
    window.addEventListener('pagehide', cancelNavigation);
    window.addEventListener('popstate', cancelNavigation);
    window.addEventListener('hashchange', cancelNavigation);

    // Canvas/history bookkeeping and page-specific link handlers run first.
    window.addEventListener('click', async event => {
        if (event.defaultPrevented || event.button !== 0
            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest?.('a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const target = new URL(link.href);
        if (target.origin !== location.origin || !['http:', 'https:'].includes(target.protocol)) return;
        if (target.pathname === location.pathname && target.search === location.search) return;
        if (!navigating && !runtime.getActiveRegistration()?.waiting) return;

        event.preventDefault();
        const id = ++navigationId;
        navigating = true;
        await runtime.updates.activate();
        if (id === navigationId) window.location.assign(target.href);
    });
}
