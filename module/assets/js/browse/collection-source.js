import { normalizeFromPath } from './navigation-state.js';

export function normalizeCollectionSource(source) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    const logicalPath = normalizeFromPath(source.logicalPath || '');
    const provider = typeof source.provider === 'string' ? source.provider.trim().toLowerCase() : '';
    const sortVariant = typeof source.sortVariant === 'string'
        ? source.sortVariant.trim().toLowerCase()
        : '';
    const defaultSort = typeof source.defaultSort === 'string'
        ? source.defaultSort.trim().toLowerCase()
        : '';
    const label = typeof source.label === 'string' ? source.label.trim() : '';
    const href = typeof source.href === 'string' ? source.href.trim() : '';

    if (!logicalPath && !provider && !sortVariant && !defaultSort && !label && !href) {
        return null;
    }

    const normalized = {};
    if (logicalPath) normalized.logicalPath = logicalPath;
    if (provider) normalized.provider = provider;
    if (sortVariant) normalized.sortVariant = sortVariant;
    if (defaultSort) normalized.defaultSort = defaultSort;
    if (label) normalized.label = label;
    if (href) normalized.href = href;
    return normalized;
}

export function readPageCollectionSource() {
    const serializedSource = document.body?.dataset.pageCollectionSource || '';
    if (!serializedSource) {
        return null;
    }

    try {
        return normalizeCollectionSource(JSON.parse(serializedSource));
    } catch (error) {
        return null;
    }
}
