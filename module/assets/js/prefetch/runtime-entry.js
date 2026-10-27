import { buildRuntimeActions, normalizeEagerness, normalizeNavigationUrl, resolvePrefetchBackend } from './policy.js';
import {
    hasSpeculationRules,
    readActivePrefetchWorker,
    readPrefetchAnchorCandidates,
    readPrefetchPayload,
    readPrefetchRuleForAnchor,
    readPrefetchRules,
    readRequestedPrefetchBackend,
    supportsLinkPrefetch,
    supportsSpeculationRules
} from './browser.js';

document.addEventListener('DOMContentLoaded', () => { void startPrefetch(); }, { once: true });

async function startPrefetch() {
    const root = document.documentElement;
    root.dataset.prefetchReady = '';
    const config = readPrefetchPayload() || {};
    const modes = config.modes || {};
    const rules = readPrefetchRules();
    const requested = readRequestedPrefetchBackend();
    const nativeAvailable = supportsSpeculationRules() && hasSpeculationRules();
    const linkAvailable = supportsLinkPrefetch();
    const enabled = Boolean(config.enabled);
    const customPossible = requested === 'sw' || requested === 'link'
        || (requested === 'auto' && enabled && !nativeAvailable);
    const warmedNavigationUrls = new Set();
    let state = { requested, backend: 'off', reason: 'selecting', dispatched: 0, failures: 0 };

    function publishState() {
        root.dataset.prefetchBackend = state.backend;
        window.banyanPrefetchState = { ...state };
        window.dispatchEvent(new CustomEvent('banyan:prefetch-state', { detail: { ...state } }));
    }

    function normalizeForCurrentPage(rawUrl) {
        const href = normalizeNavigationUrl(rawUrl, window.location.href);
        return href && href !== normalizeNavigationUrl(window.location.href, window.location.href) ? href : '';
    }

    function getAnchorWarmTarget(anchor) {
        const rule = readPrefetchRuleForAnchor(anchor, rules);
        const mode = normalizeEagerness(modes[rule]);
        if (mode === 'off' || mode === 'immediate') return null;
        const href = rule && normalizeForCurrentPage(anchor.href);
        return href && !warmedNavigationUrls.has(href) ? { href, mode } : null;
    }

    const automaticWarmup = !navigator.connection?.saveData
        && !navigator.connection?.effectiveType?.includes('2g');
    const coarsePointer = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
    // Capture DOM nodes before the bounded worker lookup or idle work can yield.
    const startupCandidates = customPossible && automaticWarmup ? readPrefetchAnchorCandidates(rules) : [];
    const viewportAnchors = customPossible && automaticWarmup && coarsePointer
        ? [...document.querySelectorAll('a[href]')].filter(anchor => getAnchorWarmTarget(anchor)?.mode === 'eager')
        : [];
    publishState();
    const worker = requested === 'sw' || (requested === 'auto' && enabled && !nativeAvailable)
        ? await readActivePrefetchWorker(config.sw) : null;
    state = { ...resolvePrefetchBackend({
        requested, enabled, nativeAvailable, swAvailable: Boolean(worker), linkAvailable
    }), dispatched: 0, failures: 0 };
    if (state.backend === 'native') root.dataset.prefetchNativeReady = '';
    publishState();
    if (state.backend === 'native' || state.backend === 'off') return;

    function claimNavigationUrl(rawUrl) {
        const href = normalizeForCurrentPage(rawUrl);
        if (!href || warmedNavigationUrls.has(href)) return '';
        warmedNavigationUrls.add(href);
        return href;
    }

    function warmNavigationUrls(rawUrls) {
        if (state.backend === 'sw') {
            const urls = rawUrls.map(claimNavigationUrl).filter(Boolean);
            if (!urls.length) return;
            try {
                worker.postMessage({ type: 'WARM_NAV_BATCH', urls });
                state.dispatched += urls.length;
            } catch (error) {
                urls.forEach(href => warmedNavigationUrls.delete(href));
                state.failures += urls.length;
            }
            publishState();
            return;
        }
        for (const rawUrl of rawUrls) {
            const href = claimNavigationUrl(rawUrl);
            if (!href) continue;
            try {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                link.setAttribute('data-prefetch-link', 'runtime');
                link.addEventListener('error', () => {
                    warmedNavigationUrls.delete(href);
                    link.remove();
                    state.failures += 1;
                    publishState();
                }, { once: true });
                document.head.appendChild(link);
                state.dispatched += 1;
            } catch (error) {
                warmedNavigationUrls.delete(href);
                state.failures += 1;
            }
            publishState();
        }
    }

    function warmAnchor(anchor, expectedMode) {
        const target = getAnchorWarmTarget(anchor);
        if (target && (!expectedMode || target.mode === expectedMode)) warmNavigationUrls([target.href]);
    }

    function eventAnchor(event) {
        return event.target instanceof Element ? event.target.closest('a[href]') : null;
    }

    let hoverTimer = null;
    let hoverAnchor = null;
    let recentTouchUntil = 0;

    function clearHover() {
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
        hoverAnchor = null;
    }

    if (rules.some(rule => !['off', 'immediate'].includes(normalizeEagerness(modes[rule.id])))) {
        document.addEventListener('mouseover', event => {
            if (!automaticWarmup || Date.now() < recentTouchUntil) return;
            const anchor = eventAnchor(event);
            const target = getAnchorWarmTarget(anchor);
            if (!target || !['moderate', 'eager'].includes(target.mode)) {
                clearHover();
                return;
            }
            if (anchor === hoverAnchor && hoverTimer !== null) return;
            clearHover();
            hoverAnchor = anchor;
            hoverTimer = window.setTimeout(() => {
                clearHover();
                warmAnchor(anchor, target.mode);
            }, target.mode === 'eager' ? 10 : 200);
        }, true);
        document.addEventListener('mouseout', event => {
            if (!hoverAnchor || eventAnchor(event) !== hoverAnchor) return;
            const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
            if (!related || !hoverAnchor.contains(related)) clearHover();
        }, true);
        document.addEventListener('mousedown', event => {
            if (event.button !== 0 || Date.now() < recentTouchUntil) return;
            clearHover();
            warmAnchor(eventAnchor(event));
        }, true);
        document.addEventListener('focusin', event => {
            if (Date.now() < recentTouchUntil) return;
            warmAnchor(eventAnchor(event));
        }, true);
        document.addEventListener('touchstart', event => {
            recentTouchUntil = Date.now() + 1200;
            clearHover();
            warmAnchor(eventAnchor(event));
        }, { capture: true, passive: true });
    }

    const actions = buildRuntimeActions(modes, startupCandidates, window.location.href);
    if (automaticWarmup && actions.immediate) warmNavigationUrls(actions.immediate);

    if (viewportAnchors.length && window.IntersectionObserver) {
        const idle = window.requestIdleCallback || (callback => window.setTimeout(callback, 1));
        idle(() => {
            const timers = new Map();
            const observer = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    const anchor = entry.target;
                    if (!entry.isIntersecting) {
                        window.clearTimeout(timers.get(anchor));
                        timers.delete(anchor);
                        continue;
                    }
                    if (timers.has(anchor) || getAnchorWarmTarget(anchor)?.mode !== 'eager') continue;
                    timers.set(anchor, window.setTimeout(() => {
                        timers.delete(anchor);
                        if (getAnchorWarmTarget(anchor)?.mode !== 'eager') return;
                        observer.unobserve(anchor);
                        warmAnchor(anchor, 'eager');
                    }, 50));
                }
            });
            viewportAnchors.forEach(anchor => observer.observe(anchor));
        });
    }
}
