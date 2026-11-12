import {
    ENTRY_LINEAGE_FIELD,
    LINEAGE_SORTS_FIELD,
    SORTS_PLACEHOLDER,
    applyFragmentField,
    readFieldValue,
} from './navigation-state.contract.js';
import { getNormalizedSortToken } from './sort-policy.js';

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
    if (decoded === '/') return '/';
    const segments = decoded.split('/').filter(Boolean);
    if (segments.length === 0) {
        return '';
    }

    return `/${segments.join('/')}/`;
}

function buildFromParamValue(logicalPath) {
    const normalizedPath = normalizeFromPath(logicalPath);
    if (normalizedPath === '/') return '/';
    if (!normalizedPath) {
        return '';
    }

    return normalizedPath.split('/').filter(Boolean).join('/');
}

export function readCurrentFromPath() {
    return normalizeFromPath(readStateParam(ENTRY_LINEAGE_FIELD));
}

function normalizeSortSlot(token) {
    const value = `${token ?? ''}`.trim().toLowerCase();
    return value === '' || value === SORTS_PLACEHOLDER ? '' : value;
}

function normalizeSortSlots(tokens) {
    return Array.isArray(tokens) ? tokens.map(normalizeSortSlot) : [];
}

export function getLogicalPathDepth(logicalPath) {
    if (normalizeFromPath(logicalPath) === '/') return 1;
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

    return [...rawTokens, ...Array(depth - rawTokens.length).fill('')];
}

export function readSortTokenForPath(logicalPath, fallbackToken = '') {
    const slots = readEffectiveSortsTokens(logicalPath);
    const current = slots.length > 0 ? slots[slots.length - 1] : '';
    return current || `${fallbackToken ?? ''}`.trim().toLowerCase();
}

export function buildCurrentPageSortsTokens(logicalPath, currentToken = '', defaultToken = '') {
    const slots = readEffectiveSortsTokens(logicalPath);
    const normalizedCurrent = normalizeSortSlot(currentToken);
    const token = normalizedCurrent === normalizeSortSlot(defaultToken) ? '' : normalizedCurrent;
    if (slots.length === 0) return [];

    const next = slots.slice();
    next[next.length - 1] = token;
    return next;
}

export function buildLineageSortsTokensForPath(lineageLogicalPath, targetLogicalPath, targetToken = '', defaultToken = '') {
    const lineageSegments = normalizeFromPath(lineageLogicalPath).split('/').filter(Boolean);
    const targetSegments = normalizeFromPath(targetLogicalPath).split('/').filter(Boolean);
    const targetBelongsToLineage = targetSegments.length > 0
        && targetSegments.length <= lineageSegments.length
        && targetSegments.every((segment, index) => segment === lineageSegments[index]);

    if (!targetBelongsToLineage) {
        return buildCurrentPageSortsTokens(targetLogicalPath, targetToken, defaultToken);
    }

    const slots = readEffectiveSortsTokens(lineageLogicalPath);
    const normalizedTarget = normalizeSortSlot(targetToken);
    slots[targetSegments.length - 1] = normalizedTarget === normalizeSortSlot(defaultToken) ? '' : normalizedTarget;
    return slots;
}

export function buildDescendantSortsTokens(logicalPath, currentToken, defaultToken, descendantVariant, descendantDefault) {
    const normalizedCurrent = normalizeSortSlot(currentToken);
    const currentSlots = buildCurrentPageSortsTokens(logicalPath, normalizedCurrent, defaultToken);
    const inherited = getNormalizedSortToken(normalizedCurrent, descendantVariant, descendantDefault);
    return [...currentSlots, inherited === descendantDefault ? '' : inherited];
}

export function applyFromPathToUrl(url, fromPath) {
    return applyFragmentField(url, ENTRY_LINEAGE_FIELD, buildFromParamValue(fromPath));
}

export function applySortsTokensToUrl(url, tokens) {
    const normalizedTokens = normalizeSortSlots(tokens);
    while (normalizedTokens.at(-1) === '') normalizedTokens.pop();
    if (normalizedTokens.length === 0) {
        return applyFragmentField(url, LINEAGE_SORTS_FIELD, '');
    }

    const encoded = normalizedTokens.map((token) => (token === '' ? SORTS_PLACEHOLDER : token));
    return applyFragmentField(url, LINEAGE_SORTS_FIELD, encoded.join(','));
}
