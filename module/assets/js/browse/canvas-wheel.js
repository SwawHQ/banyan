import { isCanvasScrollbarPoint } from './auto-scrollbar.js';

export function initCanvasWheel() {
    const root = document.documentElement;
    const shell = document.querySelector('.page-shell');
    if (!shell) return;
    const rtl = root.dir === 'rtl';
    let mousePoint;
    let middleReleasePending = false;
    let snapTimer;
    let touchScroll;
    let hintFrame = 0;
    let hintPosition = '';
    const hint = document.createElement('span');
    hint.dataset.canvasWheelHint = '';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = '↔';
    hint.hidden = true;
    document.body.appendChild(hint);
    root.dataset.canvasWheel = 'ready';
    const canvasX = () => window.visualViewport?.pageLeft ?? window.scrollX;
    const hintTransform = () => `translate(${Math.max(0, Math.min(mousePoint.x + 12, root.clientWidth - 20))}px, ${Math.max(0, Math.min(mousePoint.y + 12, root.clientHeight - 18))}px)`;

    function updateHint() {
        if (!mousePoint || document.hidden || root.dataset.canvasPointer !== 'mouse'
            || root.dataset.canvasWheel !== 'locked') {
            if (hintFrame) cancelAnimationFrame(hintFrame);
            hintFrame = 0;
            if (!hint.hidden) hint.hidden = true;
            return;
        }
        if (hintFrame || (!hint.hidden && hintPosition === hintTransform())) return;
        // Read the latest coordinates once per frame; do not schedule an idle loop.
        hintFrame = requestAnimationFrame(() => {
            hintFrame = 0;
            hintPosition = hintTransform();
            hint.style.transform = hintPosition;
            hint.hidden = false;
        });
    }

    function unlock() {
        clearTimeout(snapTimer);
        middleReleasePending = false;
        if (root.dataset.canvasWheel !== 'ready') root.dataset.canvasWheel = 'ready';
        updateHint();
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

    function markMouse(event) {
        touchScroll = undefined;
        if (root.dataset.canvasPointer !== 'mouse') root.dataset.canvasPointer = 'mouse';
        mousePoint = { x: event.clientX, y: event.clientY };
        updateHint();
    }

    window.addEventListener('resize', () => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        updateHint();
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
            mousePoint = undefined;
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
            mousePoint = undefined;
            delete root.dataset.canvasPointer;
            return unlock();
        }
        markMouse(event);
        if (event.button === 1 && root.dataset.canvasWheel !== 'suspended') {
            // shortcut: native autoscroll state is unavailable; replace click/Escape suspension when browsers expose it.
            root.dataset.canvasWheel = 'suspended';
            middleReleasePending = true;
            updateHint();
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

    function handleWheel(event) {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        const scrollbar = isCanvasScrollbarPoint(event.clientX, event.clientY);
        if (root.dataset.canvasPointer === 'touch') markMouse(event);
        // shortcut: wheel cannot distinguish a mouse from a trackpad after mouse input; use a device API if browsers add one.
        if (root.dataset.canvasPointer !== 'mouse' || root.dataset.canvasWheel === 'suspended'
            || event.defaultPrevented || (!event.cancelable && (!scrollbar || event.shiftKey))
            || event.buttons || event.ctrlKey || event.metaKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        if (root.dataset.canvasWheel !== 'locked') {
            if (root.scrollWidth <= root.clientWidth + 1 || (!scrollbar && !canStart(event.target))) return;
            if (scrollbar) mousePoint = { x: event.clientX, y: event.clientY };
            root.dataset.canvasWheel = 'locked';
            updateHint();
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

    root.addEventListener('pointerleave', () => {
        mousePoint = undefined;
        updateHint();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) return;
        mousePoint = undefined;
        updateHint();
    });
    window.addEventListener('pointercancel', () => {
        mousePoint = undefined;
        unlock();
    });
    window.addEventListener('keydown', event => {
        clearTimeout(snapTimer);
        touchScroll = undefined;
        if (event.key === 'Escape') unlock();
    });
    for (const name of ['blur', 'pagehide']) window.addEventListener(name, () => {
        touchScroll = undefined;
        mousePoint = undefined;
        delete root.dataset.canvasPointer;
        unlock();
    });
}
