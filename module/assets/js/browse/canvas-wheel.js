import { isCanvasScrollbarPoint } from './auto-scrollbar.js';

export function initCanvasWheel() {
    const root = document.documentElement;
    const shell = document.querySelector('.page-shell');
    if (!shell) return;
    const rtl = root.dir === 'rtl';
    let middleReleasePending = false;
    let snapTimer;
    let touchScroll;
    root.dataset.canvasWheel = 'ready';
    const canvasX = () => window.visualViewport?.pageLeft ?? window.scrollX;

    function unlock() {
        clearTimeout(snapTimer);
        middleReleasePending = false;
        if (root.dataset.canvasWheel !== 'ready') root.dataset.canvasWheel = 'ready';
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

    function markMouse() {
        touchScroll = undefined;
        if (root.dataset.canvasPointer !== 'mouse') root.dataset.canvasPointer = 'mouse';
    }

    window.addEventListener('resize', () => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
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
            markMouse();
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
        markMouse();
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

    function canStart(target, vertical = true) {
        if (!(target instanceof Element) || !shell.contains(target)
            || target.isContentEditable
            || target.closest('input, textarea, select, button, audio, video, iframe, summary')) return false;
        for (let node = target; node !== shell; node = node.parentElement) {
            const style = getComputedStyle(node);
            // Overflow remains scrollable at either end of its current range.
            if ((vertical && /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1)
                || (/auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1)) return false;
        }
        return true;
    }

    function handleWheel(event) {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        const scrollbar = isCanvasScrollbarPoint(event.clientX, event.clientY);
        if (root.dataset.canvasPointer === 'touch' || root.dataset.canvasWheel === 'locked') markMouse();
        // shortcut: wheel cannot distinguish a mouse from a trackpad; use a device API if browsers add one.
        if (root.dataset.canvasPointer !== 'mouse' || root.dataset.canvasWheel === 'suspended'
            || event.defaultPrevented || (!event.cancelable && (!scrollbar || event.shiftKey))
            || event.buttons || event.ctrlKey || event.metaKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        if (root.dataset.canvasWheel !== 'locked') {
            if (root.scrollWidth <= root.clientWidth + 1 || (!scrollbar && !canStart(event.target))) return;
            root.dataset.canvasWheel = 'locked';
        }
        // Without Shift, native track wheel input can be non-cancelable and needs horizontal conversion.
        if (event.cancelable) event.preventDefault();
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
    }

    // Chromium forwards native scrollbar wheel input only when a passive listener is present.
    window.addEventListener('wheel', event => {
        if (event.cancelable) handleWheel(event);
    }, { passive: false });
    window.addEventListener('wheel', event => {
        if (!event.cancelable) handleWheel(event);
    }, { passive: true });

    window.addEventListener('pointercancel', unlock);
    window.addEventListener('keydown', event => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        if (event.isComposing) return;
        if (['ArrowUp', 'ArrowDown', 'Escape', 'Tab', 'Enter', ' '].includes(event.key)) return unlock();
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
            || root.dataset.canvasWheel === 'suspended'
            || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
        if (root.scrollWidth <= root.clientWidth + 1) return unlock();
        const target = event.target === document.body || event.target === root ? shell : event.target;
        const arrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        // Only unlocked page keys defer to a column's native vertical scrolling.
        if (!canStart(target, !arrow && root.dataset.canvasWheel !== 'locked')) return;
        if (root.dataset.canvasWheel !== 'locked') {
            root.dataset.canvasWheel = 'locked';
        }
        if (arrow) return;
        event.preventDefault();
        const direction = rtl ? -1 : 1;
        const width = window.visualViewport?.width ?? root.clientWidth;
        const max = document.scrollingElement.scrollWidth - width;
        let next = event.key === 'Home' || event.key === 'PageUp' ? 0 : max;
        if (event.key === 'PageUp' || event.key === 'PageDown') {
            const position = canvasX() * direction;
            const step = event.key === 'PageUp' ? -1 : 1;
            const edge = parseFloat(getComputedStyle(document.body).paddingInlineStart);
            for (const column of shell.querySelectorAll('.page-column')) {
                const rect = column.getBoundingClientRect();
                if (!rect.width) continue;
                const start = direction * (window.scrollX + (rtl ? rect.right - root.clientWidth + edge : rect.left - edge));
                const boundary = Math.max(0, Math.min(start, max));
                if ((boundary - position) * step > 1 && (next - boundary) * step > 0) next = boundary;
            }
            // A wide column must remain readable before advancing to the next column.
            next = position + step * Math.min(width, Math.abs(next - position));
        }
        window.scrollTo({ left: next * direction, top: 0, behavior: 'instant' });
    });
    for (const name of ['blur', 'pagehide']) window.addEventListener(name, () => {
        touchScroll = undefined;
        delete root.dataset.canvasPointer;
        unlock();
    });
}
