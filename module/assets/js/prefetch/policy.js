const EAGERNESS = new Set(['off', 'conservative', 'moderate', 'eager', 'immediate']);

export function normalizeEagerness(value) {
    return EAGERNESS.has(value) ? value : 'off';
}

export function resolvePrefetchBackend({ requested = 'auto', enabled = true,
    nativeAvailable = false, swAvailable = false, linkAvailable = false } = {}) {
    if (!['auto', 'native', 'sw', 'link', 'off'].includes(requested)) requested = 'auto';
    if (requested === 'off') return { requested, backend: 'off', reason: 'requested-off' };
    if (requested === 'auto') {
        if (!enabled) return { requested, backend: 'off', reason: 'disabled' };
        const backend = nativeAvailable ? 'native' : swAvailable ? 'sw' : linkAvailable ? 'link' : 'off';
        return { requested, backend, reason: backend === 'off' ? 'no-backend' : 'auto-' + backend };
    }
    const available = { native: nativeAvailable, sw: swAvailable, link: linkAvailable }[requested];
    return { requested, backend: available ? requested : 'off',
        reason: available ? 'forced-' + requested : requested + '-unavailable' };
}

export function normalizeNavigationUrl(rawUrl, baseUrl) {
    try {
        const url = new URL(rawUrl, baseUrl);
        const current = new URL(baseUrl);
        if (!/^https?:$/.test(url.protocol) || url.origin !== current.origin) return '';
        if (!url.pathname.endsWith('/') && !/\.html?$/.test(url.pathname)) return '';
        url.hash = '';
        return url.toString();
    } catch (error) {
        return '';
    }
}

export function buildRuntimeActions(modes, candidates, pageUrl) {
    if (!modes || typeof modes !== 'object' || !Array.isArray(candidates)) return {};
    const currentUrl = normalizeNavigationUrl(pageUrl, pageUrl);
    const actions = {};
    const seen = new Set();
    for (const candidate of candidates) {
        if (!candidate) continue;
        const mode = normalizeEagerness(modes[candidate.rule]);
        const href = normalizeNavigationUrl(candidate.href, pageUrl);
        if (mode === 'off' || !href || href === currentUrl) continue;
        const key = mode + ':' + href;
        if (seen.has(key)) continue;
        seen.add(key);
        (actions[mode] ||= []).push(href);
    }
    return actions;
}
