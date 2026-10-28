export function initCanvasWheel() {
    const root = document.documentElement;
    const shell = document.querySelector('.page-shell');
    if (!shell) return;
    const group = shell.querySelector('.reading-group');
    const rtl = root.dir === 'rtl';
    let mousePoint;
    let middleReleasePending = false;
    let snapTimer;
    let touchScroll;
    root.dataset.canvasWheel = 'ready';
    const canvasX = () => window.visualViewport?.pageLeft ?? window.scrollX;

    function unlock() {
        clearTimeout(snapTimer);
        middleReleasePending = false;
        if (root.dataset.canvasWheel !== 'ready') root.dataset.canvasWheel = 'ready';
        updateGap();
    }

    function align(position, direction) {
        if (!direction || canvasX() !== position) return;
        const edge = parseFloat(getComputedStyle(document.body).paddingInlineStart);
        const max = document.scrollingElement.scrollWidth - (window.visualViewport?.width ?? root.clientWidth);
        let target = null;
        let nearest = Infinity;
        for (const column of shell.querySelectorAll('.page-column')) {
            const rect = column.getBoundingClientRect();
            if (!rect.width) continue;
            const next = window.scrollX + (rtl ? rect.right - root.clientWidth + edge : rect.left - edge);
            const offset = rtl ? -next : next;
            const distance = (next - position) * direction;
            // Finish approaching an edge; never pull a departing column back.
            if (distance > 0 && distance <= 64 && offset >= 0 && offset <= max
                && distance < nearest) {
                nearest = distance;
                target = column;
            }
        }
        if (target) {
            // Native targeting includes the phone's visual viewport.
            target.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'instant' });
        }
    }

    function updateGap() {
        let gap = false;
        const hit = mousePoint && document.elementFromPoint(mousePoint.x, mousePoint.y);
        if (root.dataset.canvasPointer === 'mouse' && mousePoint
            && (hit === shell || hit === group)) {
            let previousEnd;
            const x = rtl ? -mousePoint.x : mousePoint.x;
            for (const column of shell.querySelectorAll('.page-column')) {
                const rect = column.getBoundingClientRect();
                if (!rect.width) continue;
                const start = rtl ? -rect.right : rect.left;
                if (previousEnd !== undefined && x >= previousEnd && x < start) {
                    gap = true;
                    break;
                }
                previousEnd = rtl ? -rect.left : rect.right;
            }
        }
        root.toggleAttribute('data-canvas-wheel-gap', gap);
    }

    function markMouse(event) {
        touchScroll = undefined;
        if (root.dataset.canvasPointer !== 'mouse') root.dataset.canvasPointer = 'mouse';
        mousePoint = { x: event.clientX, y: event.clientY };
        updateGap();
    }

    window.addEventListener('scroll', updateGap, { passive: true });
    window.addEventListener('resize', () => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        updateGap();
    }, { passive: true });
    for (const viewport of [document, window.visualViewport].filter(Boolean)) {
        viewport.addEventListener('scroll', event => {
            if (!touchScroll || event.target !== viewport) return;
            const position = canvasX();
            if (position !== touchScroll.x) touchScroll.direction = Math.sign(position - touchScroll.x);
            touchScroll.x = position;
            touchScroll.pending.add(viewport);
        }, { passive: true });
        // Wait for every moving viewport; a pause while holding a finger is not the end of inertia.
        // shortcut: missing scrollend leaves native panning; add a reliable completion API if those browsers need snapping.
        viewport.addEventListener('scrollend', event => {
            if (!touchScroll || event.target !== viewport) return;
            touchScroll.pending.delete(viewport);
            if (touchScroll.active || touchScroll.pending.size) return;
            const gesture = touchScroll;
            touchScroll = undefined;
            if (gesture.moved && root.dataset.canvasPointer === 'touch'
                && (!window.visualViewport || window.visualViewport.scale === 1)) align(gesture.x, gesture.direction);
        }, { passive: true });
    }
    window.visualViewport?.addEventListener('resize', () => { touchScroll = undefined; }, { passive: true });
    window.addEventListener('touchstart', event => {
        root.dataset.canvasPointer = 'touch';
        unlock();
        touchScroll = event.touches.length === 1 && shell.contains(event.target)
            && (!window.visualViewport || window.visualViewport.scale === 1)
            ? { x: canvasX(), direction: 0, active: true, moved: false, pending: new Set() } : undefined;
    }, { passive: true });
    window.addEventListener('touchmove', event => {
        if (!touchScroll) return;
        if (event.touches.length !== 1 || (window.visualViewport && window.visualViewport.scale !== 1)) touchScroll = undefined;
        else touchScroll.moved = true;
    }, { passive: true });
    window.addEventListener('touchend', event => {
        if (!touchScroll) return;
        if (!touchScroll.moved || !touchScroll.direction) touchScroll = undefined;
        else touchScroll.active = event.touches.length > 0;
    }, { passive: true });
    window.addEventListener('touchcancel', () => { touchScroll = undefined; }, { passive: true });

    window.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse') {
            markMouse(event);
        } else {
            if (event.pointerType !== 'touch') {
                touchScroll = undefined;
                delete root.dataset.canvasPointer;
            }
            unlock();
        }
    }, { passive: true });

    window.addEventListener('pointerdown', event => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        if (event.pointerType !== 'mouse') {
            delete root.dataset.canvasPointer;
            return unlock();
        }
        markMouse(event);
        if (event.button === 1 && root.dataset.canvasWheel !== 'suspended') {
            // shortcut: native autoscroll state is unavailable; replace click/Escape suspension when browsers expose it.
            root.dataset.canvasWheel = 'suspended';
            middleReleasePending = true;
        } else {
            unlock();
        }
    }, { capture: true });

    window.addEventListener('pointerup', event => {
        if (event.pointerType !== 'mouse' || root.dataset.canvasWheel !== 'suspended') return;
        // Chrome can consume the click that cancels autoscroll before pointerdown reaches the page.
        if (event.button === 1 && middleReleasePending) middleReleasePending = false;
        else unlock();
    }, { capture: true });

    function canStart(target) {
        if (!(target instanceof Element) || !shell.contains(target)
            || target.isContentEditable
            || target.closest('input, textarea, select, button, audio, video, iframe')) return false;
        for (let node = target; node !== shell; node = node.parentElement) {
            const style = getComputedStyle(node);
            // Overflow remains scrollable at either end of its current range.
            if ((/auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1)
                || (/auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1)) return false;
        }
        return true;
    }

    window.addEventListener('wheel', event => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        if (root.dataset.canvasPointer === 'touch') markMouse(event);
        // shortcut: wheel cannot distinguish a mouse from a trackpad after mouse input; use a device API if browsers add one.
        if (root.dataset.canvasPointer !== 'mouse' || root.dataset.canvasWheel === 'suspended'
            || event.defaultPrevented || !event.cancelable
            || event.buttons || event.ctrlKey || event.metaKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        if (root.dataset.canvasWheel !== 'locked') {
            const canvas = document.scrollingElement;
            if (canvas.scrollWidth <= canvas.clientWidth + 1 || !canStart(event.target)) return;
            root.dataset.canvasWheel = 'locked';
        }
        event.preventDefault();
        const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? parseFloat(getComputedStyle(shell).lineHeight)
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? root.clientWidth : 1;
        const before = canvasX();
        window.scrollBy({ left: event.deltaY * unit * (rtl ? -1 : 1), top: 0, behavior: 'instant' });
        const position = canvasX();
        const direction = Math.sign(position - before);
        if (!direction) return;
        snapTimer = setTimeout(() => {
            if (root.dataset.canvasWheel === 'locked' && root.dataset.canvasPointer === 'mouse') align(position, direction);
        }, 180);
    }, { passive: false });

    window.addEventListener('pointercancel', unlock);
    window.addEventListener('keydown', event => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        if (event.key === 'Escape') unlock();
    });
    for (const name of ['blur', 'pagehide']) window.addEventListener(name, () => {
        touchScroll = undefined;
        delete root.dataset.canvasPointer;
        unlock();
    });
}
