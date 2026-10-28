export function initAutoScrollbar(column) {
    if (column.hasAttribute('data-auto-scrollbar')) return;
    const canvas = column === document.scrollingElement;
    let timer;
    column.dataset.autoScrollbar = '';
    column.addEventListener('pointermove', event => {
        const x = event.clientX - column.getBoundingClientRect().left;
        column.toggleAttribute('data-scrollbar-hover',
            canvas ? event.clientY >= column.clientHeight
                : event.target === column && (x < column.clientLeft
                    || x >= column.clientLeft + column.clientWidth));
    });
    column.addEventListener('pointerleave', () => column.removeAttribute('data-scrollbar-hover'));
    const onScroll = () => {
        column.dataset.scrolling = '';
        clearTimeout(timer);
        timer = setTimeout(() => delete column.dataset.scrolling, 500);
    };
    (canvas ? window : column).addEventListener('scroll', onScroll, { passive: true });
    if (canvas) window.visualViewport?.addEventListener('scroll', onScroll, { passive: true });
}
