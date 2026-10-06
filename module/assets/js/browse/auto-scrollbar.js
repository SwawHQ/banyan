export function initAutoScrollbar(column) {
    if (column.hasAttribute('data-auto-scrollbar')) return;
    let timer;
    column.dataset.autoScrollbar = '';
    column.addEventListener('pointermove', event => {
        column.toggleAttribute('data-scrollbar-hover',
            event.target === column && event.offsetX >= column.clientWidth);
    });
    column.addEventListener('pointerleave', () => column.removeAttribute('data-scrollbar-hover'));
    column.addEventListener('scroll', () => {
        column.dataset.scrolling = '';
        clearTimeout(timer);
        timer = setTimeout(() => delete column.dataset.scrolling, 500);
    }, { passive: true });
}
