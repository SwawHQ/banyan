import { normalizeCollectionSource } from './collection-source.js';
import { decodeItemsPayload } from './collection-items.js';
import { normalizePathname } from './navigation-state.js';
import { parseEntrySources } from './entry-source.js';
import { normalizeIcon } from './icon-value.js';

function normalizeLinkItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const text = typeof item.text === 'string' ? item.text.trim() : '';
    const href = typeof item.href === 'string' ? item.href.trim() : '';
    if (!text || !href) {
        return null;
    }

    const normalized = { text, href };
    if (typeof item.title === 'string' && item.title.trim() !== '') {
        normalized.title = item.title.trim();
    }
    if (typeof item.current === 'boolean') {
        normalized.current = item.current;
    }
    const icon = normalizeIcon(item.icon);
    if (icon) normalized.icon = icon;
    if (typeof item.kind === 'string' && item.kind.trim() !== '') {
        normalized.kind = item.kind.trim();
    }
    return normalized;
}

function decodeColumn(column) {
    return {
        source: normalizeCollectionSource(column?.source),
        payload: decodeItemsPayload(column?.payload),
        items: Array.isArray(column?.items) ? column.items.map(normalizeLinkItem).filter(Boolean) : [],
    };
}

export function parseEntryBreadcrumbSources(rawValue) {
    return parseEntrySources(rawValue).map(source => ({
        logicalPath: source.logicalPath,
        rootItem: normalizeLinkItem(source.rootItem),
        columns: (Array.isArray(source.columns) ? source.columns : []).flatMap(column => {
            const selected = normalizeLinkItem(column?.selected);
            return selected ? [{ ...decodeColumn(column), selected }] : [];
        }),
        currentColumn: decodeColumn(source.currentColumn),
    }));
}

let cachedValue;
let cachedSources = [];

export function readEntryBreadcrumbSources() {
    const value = document.body?.dataset.entryBreadcrumbSources || '';
    if (value !== cachedValue) {
        cachedSources = parseEntryBreadcrumbSources(value);
        cachedValue = value;
    }
    return cachedSources;
}

function normalizeCollectionHref(href) {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref) {
        return '';
    }

    try {
        return normalizePathname(new URL(rawHref, window.location.origin).pathname);
    } catch (error) {
        return '';
    }
}

function addCollectionSourceToIndex(index, source, payload = null) {
    const hrefKey = normalizeCollectionHref(source?.href || '');
    if (hrefKey) {
        index.set(hrefKey, {
            source,
            payload: payload && typeof payload === 'object' ? payload : null,
        });
    }
}

export function createCollectionSourceIndex(sources) {
    const index = new Map();

    (Array.isArray(sources) ? sources : []).forEach((source) => {
        [source.currentColumn, ...(source.columns || [])].forEach(column => {
            addCollectionSourceToIndex(index, column?.source, column?.payload);
        });
    });

    return index;
}

export function pickCollectionSourceByHref(index, href) {
    if (!(index instanceof Map)) {
        return null;
    }

    const hrefKey = normalizeCollectionHref(href);
    return hrefKey ? index.get(hrefKey)?.source || null : null;
}

export function pickCollectionItemsByHref(index, href) {
    if (!(index instanceof Map)) {
        return null;
    }

    const hrefKey = normalizeCollectionHref(href);
    return hrefKey ? index.get(hrefKey)?.payload || null : null;
}
