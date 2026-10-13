import { applyFragmentField, readAnchor } from '../browse/navigation-state.contract.js';

export function initDocumentAnchors() {
    function updateLink(link) {
        if (!(link instanceof HTMLAnchorElement)) return;
        if (link.origin !== location.origin || link.pathname !== location.pathname
            || link.search !== location.search || !link.hash) return;
        // Only chapter links inherit the current view; source/sort links own their state.
        if (link.hash.includes('=') && !link.dataset.chapterAnchor) return;
        const anchor = readAnchor(link.hash);
        if (!anchor || !document.getElementById(anchor)) return;
        link.dataset.chapterAnchor = anchor;
        const target = applyFragmentField(new URL(location.href), 'anchor', anchor);
        link.href = target.pathname + target.search + target.hash;
        return true;
    }

    function refresh() {
        document.querySelectorAll('a[href]').forEach(updateLink);
    }

    function reveal() {
        refresh();
        const target = document.getElementById(readAnchor(location.hash));
        if (!target) return;
        target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
        const content = document.querySelector('.page-content');
        if (content?.contains(target)) {
            content.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
        if (target.id === 'main') {
            if (content) content.scrollTop = 0;
        }
        target.focus({ preventScroll: true });
    }

    // Refresh at activation too: replaceState does not emit hashchange.
    for (const name of ['click', 'auxclick', 'contextmenu', 'focusin']) {
        document.addEventListener(name, event => {
            const link = event.target.closest?.('a[href]');
            if (updateLink(link) && name === 'click' && event.button === 0
                && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
                && !link.hasAttribute('download') && (!link.target || link.target === '_self')) {
                requestAnimationFrame(() => { if (!event.defaultPrevented) reveal(); });
            }
        }, true);
    }
    window.addEventListener('hashchange', () => requestAnimationFrame(reveal));
    window.addEventListener('pageshow', () => requestAnimationFrame(reveal));
    refresh();
}
