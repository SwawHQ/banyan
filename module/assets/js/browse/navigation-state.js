import {
    ACTIVE_SORT_FIELD,
    ENTRY_LINEAGE_FIELD,
    LINEAGE_SORTS_FIELD,
    SORTS_PLACEHOLDER,
    applyFragmentField,
    readFieldValue,
} from './navigation-state.contract.js';

export { SORTS_PLACEHOLDER };

function safeDecode(value) {
    if (typeof value !== 'string' || value === '') {
        return '';
    }

    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}

function readStateParam(field) {
    return readFieldValue(window.location.hash, field);
}

export function normalizeFromPath(value) {
    const decoded = safeDecode(typeof value === 'string' ? value.trim() : '');
    const segments = decoded.split('/').filter(Boolean);
    if (segments.length === 0) {
        return '';
    }

    return `/${segments.join('/')}/`;
}

function buildFromParamValue(logicalPath) {
    const normalizedPath = normalizeFromPath(logicalPath);
    if (!normalizedPath) {
        return '';
    }

    return normalizedPath.split('/').filter(Boolean).join('/');
}

export function readCurrentFromPath() {
    return normalizeFromPath(readStateParam(ENTRY_LINEAGE_FIELD));
}

export function readCurrentSortTokenRaw() {
    return safeDecode(readStateParam(ACTIVE_SORT_FIELD)).trim().toLowerCase();
}

function normalizeSortSlot(token) {
    const value = `${token ?? ''}`.trim().toLowerCase();
    return value === '' || value === SORTS_PLACEHOLDER ? '' : value;
}

function normalizeSortSlots(tokens) {
    return Array.isArray(tokens) ? tokens.map(normalizeSortSlot) : [];
}

export function getLogicalPathDepth(logicalPath) {
    return normalizeFromPath(logicalPath).split('/').filter(Boolean).length;
}

export function normalizePathname(pathname) {
    if (typeof pathname !== 'string' || pathname === '') {
        return '/';
    }

    const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return normalized === '//' ? '/' : normalized;
}

function readCurrentSortsTokens() {
    const rawValue = safeDecode(readStateParam(LINEAGE_SORTS_FIELD));
    if (!rawValue.trim()) {
        return [];
    }

    return normalizeSortSlots(rawValue.split(','));
}

export function readEffectiveSortsTokens(logicalPath) {
    const depth = getLogicalPathDepth(logicalPath);
    const rawTokens = readCurrentSortsTokens();
    if (depth <= 0) {
        return rawTokens;
    }

    if (rawTokens.length === depth) {
        return rawTokens.slice();
    }
    if (rawTokens.length > depth) {
        return rawTokens.slice(0, depth);
    }

    return [...Array(depth - rawTokens.length).fill(''), ...rawTokens];
}

export function readSortTokenForPath(logicalPath, fallbackToken = '') {
    const slots = readEffectiveSortsTokens(logicalPath);
    const current = slots.length > 0 ? slots[slots.length - 1] : '';
    return current || `${fallbackToken ?? ''}`.trim().toLowerCase();
}

export function buildCurrentPageSortsTokens(logicalPath, currentToken = '') {
    const slots = readEffectiveSortsTokens(logicalPath);
    const normalizedCurrent = normalizeSortSlot(currentToken);
    if (!normalizedCurrent) {
        return slots;
    }

    if (slots.length === 0) {
        return [normalizedCurrent];
    }

    const next = slots.slice();
    next[next.length - 1] = normalizedCurrent;
    return next;
}

export function buildLineageSortsTokensForPath(lineageLogicalPath, targetLogicalPath, targetToken = '') {
    const lineageSegments = normalizeFromPath(lineageLogicalPath).split('/').filter(Boolean);
    const targetSegments = normalizeFromPath(targetLogicalPath).split('/').filter(Boolean);
    const targetBelongsToLineage = targetSegments.length > 0
        && targetSegments.length <= lineageSegments.length
        && targetSegments.every((segment, index) => segment === lineageSegments[index]);

    if (!targetBelongsToLineage) {
        return buildCurrentPageSortsTokens(targetLogicalPath, targetToken);
    }

    const slots = readEffectiveSortsTokens(lineageLogicalPath);
    slots[targetSegments.length - 1] = normalizeSortSlot(targetToken);
    return slots;
}

export function buildDescendantSortsTokens(logicalPath, currentToken = '') {
    const normalizedCurrent = normalizeSortSlot(currentToken);
    const currentSlots = buildCurrentPageSortsTokens(logicalPath, normalizedCurrent);
    if (!normalizedCurrent) {
        return currentSlots;
    }

    return [...currentSlots, normalizedCurrent];
}

export function buildDefaultSortsTokens(logicalPath, defaultToken = '', extraDepth = 0) {
    const depth = getLogicalPathDepth(logicalPath) + Math.max(0, Number(extraDepth) || 0);
    const normalizedDefault = normalizeSortSlot(defaultToken);
    if (depth <= 0 || !normalizedDefault) {
        return [];
    }

    return Array(depth).fill(normalizedDefault);
}

export function applyFromPathToUrl(url, fromPath) {
    return applyFragmentField(url, ENTRY_LINEAGE_FIELD, buildFromParamValue(fromPath));
}

export function applySortFieldToUrl(url, token) {
    return applyFragmentField(url, ACTIVE_SORT_FIELD, token);
}

function everySortSlotIsDefault(tokens, defaultTokens) {
    if (!Array.isArray(defaultTokens) || defaultTokens.length === 0) {
        return false;
    }

    return tokens.every((token, index) => {
        const defaultToken = normalizeSortSlot(defaultTokens[index] ?? '');
        return token === '' || (defaultToken !== '' && token === defaultToken);
    });
}

export function applySortsTokensToUrl(url, tokens, defaultTokens = []) {
    const normalizedTokens = normalizeSortSlots(tokens);
    if (
        normalizedTokens.length === 0
        || normalizedTokens.every((token) => token === '')
        || everySortSlotIsDefault(normalizedTokens, normalizeSortSlots(defaultTokens))
    ) {
        return applyFragmentField(url, LINEAGE_SORTS_FIELD, '');
    }

    const encoded = normalizedTokens.map((token) => (token === '' ? SORTS_PLACEHOLDER : token));
    return applyFragmentField(url, LINEAGE_SORTS_FIELD, encoded.join(','));
}
