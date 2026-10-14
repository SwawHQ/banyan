function readJsonObjectScript(id) {
    const node = document.getElementById(id);
    if (!node) return null;

    try {
        const parsed = JSON.parse(node.textContent || '{}');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        return null;
    }
}

export function readPrefetchPayload() {
    return readJsonObjectScript('site-prefetch-data');
}

export function readPrefetchState() {
    const state = window.banyanPrefetchState;
    return state && typeof state === 'object' ? { ...state } : null;
}

export function readRequestedPrefetchBackend() {
    if (!document.body?.hasAttribute('data-prefetch-debug')) return 'auto';
    const requested = new URLSearchParams(window.location.search).get('prefetch-backend');
    return ['native', 'sw', 'link', 'off'].includes(requested) ? requested : 'auto';
}

export function hasSpeculationRules() {
    return Boolean(document.getElementById('site-speculation-rules')?.textContent.trim());
}

export async function readActivePrefetchWorker(config, timeoutMs = 250) {
    if (!config?.enabled || typeof config.scope !== 'string' || !config.scope
        || typeof config.url !== 'string' || !config.url || !supportsServiceWorkerApi()) return null;
    let timer;
    try {
        const scope = new URL(config.scope, window.location.href);
        const script = new URL(config.url, window.location.href);
        if (scope.origin !== window.location.origin || script.origin !== scope.origin) return null;
        const registration = await Promise.race([
            navigator.serviceWorker.getRegistration(scope.href),
            new Promise(resolve => { timer = window.setTimeout(() => resolve(null), timeoutMs); })
        ]);
        const worker = registration?.active;
        return registration?.scope === scope.href && worker?.scriptURL === script.href
            && worker.state === 'activated' ? worker : null;
    } catch (error) {
        return null;
    } finally {
        window.clearTimeout(timer);
    }
}

export function supportsLinkPrefetch() {
    try {
        const link = document.createElement('link');
        return Boolean(
            link.relList
            && typeof link.relList.supports === 'function'
            && link.relList.supports('prefetch')
        );
    } catch (error) {
        return false;
    }
}

export function supportsServiceWorkerApi() {
    return 'serviceWorker' in navigator;
}

export function supportsSpeculationRules() {
    try {
        return typeof HTMLScriptElement !== 'undefined'
            && typeof HTMLScriptElement.supports === 'function'
            && HTMLScriptElement.supports('speculationrules');
    } catch (error) {
        return false;
    }
}

export function readPrefetchRules(kind = 'prefetch') {
    const rules = readJsonObjectScript('site-prefetch-rules')?.[kind];
    if (!Array.isArray(rules)) return [];
    return rules.filter(rule => {
        if (!rule || typeof rule.id !== 'string' || typeof rule.selector !== 'string') return false;
        try {
            return typeof CSS !== 'undefined' && CSS.supports(`selector(${rule.selector})`);
        } catch (error) {
            return false;
        }
    });
}

export function isWarmablePrefetchAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    if (anchor.target && anchor.target.toLowerCase() !== '_self') return false;
    return !anchor.hasAttribute('download');
}

export function readPrefetchRuleForAnchor(anchor, rules = readPrefetchRules()) {
    if (!isWarmablePrefetchAnchor(anchor)) return '';
    return rules.find(rule => anchor.matches(rule.selector))?.id || '';
}

export function readPrefetchAnchorCandidates(rules = readPrefetchRules()) {
    const candidates = [];
    for (const rule of rules) {
        for (const anchor of document.querySelectorAll(rule.selector)) {
            if (!isWarmablePrefetchAnchor(anchor)) continue;
            if (readPrefetchRuleForAnchor(anchor, rules) !== rule.id) continue;
            candidates.push({ href: anchor.href, rule: rule.id });
        }
    }

    return candidates;
}
