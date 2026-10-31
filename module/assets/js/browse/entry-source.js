import { normalizeFromPath, readCurrentFromPath } from './navigation-state.js';

export function parseNavigation(rawValue) {
    try {
        const value = JSON.parse(rawValue);
        if (!value || typeof value !== 'object' || Array.isArray(value)
            || !value.columns || typeof value.columns !== 'object' || Array.isArray(value.columns)
            || typeof value.home !== 'string' || !value.home.startsWith('/') || value.home.startsWith('//')
            || !value.home.endsWith('/') || typeof value.resources !== 'string' || typeof value.default !== 'string') return null;
        const columns = Object.fromEntries(Object.entries(value.columns).flatMap(([path, hash]) => {
            const key = normalizeFromPath(path);
            return key ? [[key, { hash, href: value.home + path.replace(/^\/+/, '') }]] : [];
        }));
        return {
            home: value.home, resources: value.resources, columns,
            default: normalizeFromPath(value.default),
            error: typeof value.error === 'string' ? value.error : '',
        };
    } catch (_) {
        return null;
    }
}

let cachedValue;
let cachedNavigation;

export function readNavigation() {
    const value = document.body?.dataset.navigation || '';
    if (value !== cachedValue) {
        cachedNavigation = parseNavigation(value);
        cachedValue = value;
    }
    return cachedNavigation;
}

export function selectNavigationRoute(navigation, fromPath, collectionPath = '') {
    const from = normalizeFromPath(fromPath);
    const collection = normalizeFromPath(collectionPath);
    const own = from && from === collection;
    const requested = from && !own
        && Object.hasOwn(navigation?.columns || {}, from) ? from : '';
    const path = requested || navigation?.default || '';
    const parts = path.split('/').filter(Boolean);
    const keys = parts.map((_, index) => `/${parts.slice(0, index + 1).join('/')}/`)
        .filter(key => Object.hasOwn(navigation?.columns || {}, key));
    const columns = keys.map((column, index) => ({ column,
        ...(index + 1 < keys.length ? { selected: navigation.columns[keys[index + 1]].href } : {}) }));
    const href = navigation?.columns[path]?.href || '';
    const first = href ? href.slice(navigation.home.length).split('/')[0] : '';
    return { root: first ? `${navigation.home}${first}/` : '', columns, lineage: requested || collection || path, from: requested };
}

export function readActiveNavigationRoute() {
    return selectNavigationRoute(readNavigation(), readCurrentFromPath(), document.body?.dataset.collectionPath || '');
}
