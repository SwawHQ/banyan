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
        saveCanvasPosition(href);
        window.location.assign(href);
    });
}
