import { saveCanvasPosition } from './canvas-position.js';

export function isPlainPrimaryClick(event, link) {
    return !event.defaultPrevented && event.button === 0
        && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && !link.hasAttribute('download') && (!link.target || link.target === '_self');
}

export function initSelectedEntry(container, selector, parentHref) {
    container?.addEventListener('click', event => {
        const entry = event.target.closest?.(selector);
        if (!entry || !isPlainPrimaryClick(event, entry)) return;
        const href = parentHref(entry);
        if (!href) return;
        event.preventDefault();
        const column = entry.closest('[data-breadcrumb-column], [data-root-navigation]');
        let clipped = false;
        if (event.detail > 0 && column) {
            const rect = column.getBoundingClientRect();
            const view = window.visualViewport;
            const left = view?.offsetLeft ?? 0;
            const edge = document.documentElement.dir === 'rtl' ? left + (view?.width ?? innerWidth) : left;
            clipped = rect.left < edge && rect.right > edge;
        }
        saveCanvasPosition(href, clipped);
        window.location.assign(href);
    });
}
