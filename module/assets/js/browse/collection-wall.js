import { fitWallSize } from './wall-fit.js';
const wall = document.querySelector('[data-wall]');
if (wall) {
    const grid = wall.querySelector('.wall-grid');
    const cards = [...grid.children];
    const group = wall.closest('.reading-group');
    const equal = wall.dataset.wallLayout === 'equal-height';
    const fixed = wall.dataset.wallLayout === 'grid';
    const size = Number(equal ? wall.dataset.wallHeight : wall.dataset.wallWidth);
    const clampSize = value => Math.max(1, Math.min(size, value));
    if (fixed) wall.style.setProperty('--wall-ratio', Number(wall.dataset.wallWidth) / Number(wall.dataset.wallHeight));
    const horizontal = wall.dataset.wallScroll === 'horizontal';
    wall.style.setProperty('--wall-size', `${size}px`);
    let frame;
    const ratios = new Map(cards.map(card => {
        const image = card.querySelector('.wall-cover > img');
        return [card, image ? Number(image.getAttribute('width')) / Number(image.getAttribute('height')) : 1.1];
    }));
    const heightOf = card => card.querySelector('.wall-cover').getBoundingClientRect().height
        + (wall.dataset.wallDetails === 'title' ? card.querySelector('.wall-detail').getBoundingClientRect().height : 0);
    function layout() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            const canvasX = scrollX;
            const gap = parseFloat(getComputedStyle(grid).columnGap);
            const before = [...group.parentElement.querySelectorAll('.page-rail,.breadcrumb-column')]
                .filter(el => el.getClientRects().length && getComputedStyle(el).display !== 'none');
            const used = before.reduce((sum, el) => sum + el.getBoundingClientRect().width + gap, 0);
            const width = Math.max(1, innerWidth - (innerWidth - used >= 240 ? used : 0) - 16);
            group.style.setProperty('--wall-width', `${width}px`);
            wall.dataset.wallReady = '';
            if (!equal && !horizontal) {
                wall.style.setProperty('--wall-column-width', `${fitWallSize(width, size, gap, 0, cards.length)}px`);
            }
            if (equal) {
                let height = size;
                const sizeCards = () => {
                    cards.forEach(card => {
                        const ratio = ratios.get(card);
                        const cardHeight = horizontal ? height : Math.min(height, width / ratio);
                        card.style.setProperty('--wall-height', `${cardHeight}px`);
                        card.style.inlineSize = `${cardHeight * ratio}px`;
                    });
                };
                sizeCards();
                if (horizontal) {
                    const room = Math.max(40, innerHeight - grid.getBoundingClientRect().top - 20);
                    let row = Math.max(1, ...cards.map(heightOf));
                    const caption = row - height;
                    height = fitWallSize(room, size, gap, caption, cards.length);
                    const lanes = Array(Math.max(1, Math.min(cards.length, Math.floor((room + gap) / (height + caption + gap))))).fill(0);
                    sizeCards();
                    row = Math.max(1, ...cards.map(heightOf));
                    for (const card of cards) {
                        const lane = lanes.indexOf(Math.min(...lanes));
                        card.style.insetInlineStart = `${lanes[lane]}px`;
                        card.style.top = `${lane * (row + gap)}px`;
                        lanes[lane] += card.getBoundingClientRect().width + gap;
                    }
                    grid.style.inlineSize = `${Math.max(0, ...lanes.map(x => x - gap))}px`;
                    grid.style.blockSize = cards.length ? `${lanes.length * (row + gap) - gap}px` : '0px';
                }
            } else if (horizontal) {
                const room = Math.max(40, innerHeight - grid.getBoundingClientRect().top - 20);
                const caption = wall.dataset.wallDetails === 'title' ? Math.max(0, ...cards.map(card => card.querySelector('.wall-detail').getBoundingClientRect().height)) : 0;
                const columnWidth = fixed ? fitWallSize(room, Number(wall.dataset.wallHeight), gap, caption, cards.length) * Number(wall.dataset.wallWidth) / Number(wall.dataset.wallHeight) : size;
                let x = 0, y = 0;
                for (const card of cards) {
                    card.style.inlineSize = `${columnWidth}px`;
                    let height = heightOf(card);
                    if (height > room) {
                        card.style.inlineSize = `${clampSize(columnWidth * Math.max(1, room - caption) / Math.max(1, height - caption))}px`;
                        height = heightOf(card);
                    }
                    if (y && y + height > room) { x += columnWidth + gap; y = 0; }
                    card.style.insetInlineStart = `${x}px`;
                    card.style.top = `${y}px`;
                    y += height + gap;
                }
                grid.style.inlineSize = cards.length ? `${x + columnWidth}px` : '0px';
                grid.style.blockSize = cards.length ? `${room}px` : '0px';
            } else if (wall.dataset.wallLayout === 'masonry') {
                cards.forEach(card => { card.style.gridRowEnd = `span ${Math.ceil(heightOf(card) + gap)}`; });
            }
            if (horizontal) scrollTo({left: canvasX, behavior: 'instant'});
        });
    }
    for (const card of cards) {
        const button = card.querySelector('.wall-detail');
        const info = card.querySelector('.wall-info');
        const position = () => {
            const box = button.getBoundingClientRect();
            info.style.left = `${Math.max(8, Math.min(box.right - info.offsetWidth, innerWidth - info.offsetWidth - 8))}px`;
            info.style.top = `${Math.max(8, Math.min(box.bottom + 6, innerHeight - info.offsetHeight - 8))}px`;
        };
        info.addEventListener('toggle', () => {
            const open = info.matches(':popover-open');
            button.setAttribute('aria-expanded', String(open));
            if (open) position();
        });
        info.querySelector('.wall-info-close').addEventListener('click', () => {
            info.hidePopover();
            button.focus({preventScroll: true});
        });
    }
    window.addEventListener('resize', () => {
        wall.querySelectorAll('.wall-info:popover-open').forEach(info => info.hidePopover());
        layout();
    });
    const navigation = document.querySelector('.breadcrumb-navigation');
    if (navigation) new MutationObserver(layout).observe(navigation, {childList: true, subtree: true});
    document.fonts.ready.then(layout);
    window.addEventListener('pageshow', layout);
    layout();
}
