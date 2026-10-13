import { normalizeFromPath } from './navigation-state.js';

export function parseEntrySources(rawValue) {
    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) return [];
        return parsed.flatMap((source) => {
            if (!source || typeof source !== 'object') return [];
            const logicalPath = normalizeFromPath(source.logicalPath);
            const root = source.rootItem;
            const text = typeof root?.text === 'string' ? root.text.trim() : '';
            const href = typeof root?.href === 'string' ? root.href.trim() : '';
            if (!logicalPath || !text || !href) return [];
            return [{ ...source, logicalPath, rootItem: { ...root, text, href } }];
        });
    } catch (error) {
        return [];
    }
}

let cachedValue;
let cachedSources = [];

export function readEntrySources() {
    const value = document.body?.dataset.entryBreadcrumbSources || '';
    if (value !== cachedValue) {
        cachedSources = parseEntrySources(value);
        cachedValue = value;
    }
    return cachedSources;
}

export function parseEntrySelection(sources, fromPath) {
    const source = pickSourceByLogicalPath(sources, fromPath);
    return source ? { source } : null;
}

export function pickSourceByLogicalPath(sources, logicalPath) {
    const normalized = normalizeFromPath(logicalPath);
    if (!normalized || !Array.isArray(sources)) return null;
    return sources.find(source => source?.logicalPath === normalized) || null;
}
