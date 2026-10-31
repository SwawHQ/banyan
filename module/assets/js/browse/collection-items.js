import {
    SORT_VARIANTS,
    compareSortRecords,
    parseSortToken,
    readCurrentSortToken,
} from './sort-policy.js';
import {
    normalizeFromPath,
    readSortTokenForPath,
} from './navigation-state.js';

export function supportsItemsPayloadProvider(provider) {
    return `${provider ?? ''}`.trim().toLowerCase() === 'collection';
}

function toRowSortKey(dataKey) {
    return String(dataKey || '')
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase();
}

export function decodeItemsPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const fields = Array.isArray(payload.f)
        ? payload.f.filter((field) => typeof field === 'string' && field.trim() !== '')
        : [];
    const rowVector = Array.isArray(payload.rv) ? payload.rv : [];
    if (fields.length === 0 || rowVector.length % fields.length !== 0) {
        return null;
    }

    const constants = payload.c && typeof payload.c === 'object' ? payload.c : {};
    const rows = [];

    for (let offset = 0, index = 0; offset < rowVector.length; offset += fields.length, index += 1) {
        const row = { ...constants, _originalIndex: index };
        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
            const field = fields[fieldIndex];
            const rawValue = rowVector[offset + fieldIndex];
            row[field] = field === 'icon' ? rawValue : (typeof rawValue === 'string' ? rawValue : `${rawValue ?? ''}`);
        }
        rows.push(row);
    }

    const sortVariant = typeof payload.sv === 'string' ? payload.sv.trim().toLowerCase() : '';
    const defaultSort = typeof payload.ds === 'string' ? payload.ds.trim().toLowerCase() : '';
    const provider = typeof payload.p === 'string' ? payload.p.trim().toLowerCase() : '';
    const logicalPath = typeof payload.lp === 'string' ? normalizeFromPath(payload.lp) : '';

    const label = typeof payload.label === 'string' ? payload.label : '';
    const href = typeof payload.href === 'string' ? payload.href : '';
    return { provider, logicalPath, sortVariant, defaultSort, label, href, rows };
}

function readItemsRowValue(row, fieldConfig) {
    if (!row || !fieldConfig) {
        return '';
    }

    return row[toRowSortKey(fieldConfig.dataKey)] ?? '';
}

function readItemsRowGroup(row) {
    return row?.kind === 'page' ? 1 : 0;
}

function readItemsRowStableKey(row) {
    return row?.href || (row?._originalIndex ?? '');
}

export function readRequestedSortToken(sortVariant, logicalPath = '', defaultSort = '') {
    if (!sortVariant) {
        return '';
    }

    const fallbackToken = defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken || '';
    if (!logicalPath) {
        return readCurrentSortToken(sortVariant, fallbackToken);
    }

    const normalizedLogicalPath = normalizeFromPath(logicalPath);
    return readSortTokenForPath(normalizedLogicalPath, fallbackToken);
}

export function sortItemsRows(rows, sortVariant, logicalPath = '', defaultSort = '') {
    const variant = SORT_VARIANTS[sortVariant];
    if (!variant) {
        return {
            rows: Array.isArray(rows) ? rows.slice() : [],
            token: '',
            defaultToken: defaultSort || ''
        };
    }

    const defaultToken = defaultSort || variant.defaultToken;
    const token = readRequestedSortToken(sortVariant, logicalPath, defaultToken);
    const current = parseSortToken(token);
    if (!variant.fields[current.field]) {
        return {
            rows: Array.isArray(rows) ? rows.slice() : [],
            token,
            defaultToken
        };
    }

    const sortedRows = (Array.isArray(rows) ? rows.slice() : []).sort((left, right) => {
        return compareSortRecords(left, right, {
            variant,
            field: current.field,
            order: current.order,
            readValue: readItemsRowValue,
            readGroup: readItemsRowGroup,
            readStableKey: readItemsRowStableKey,
        });
    });

    return { rows: sortedRows, token, defaultToken };
}

export function isCollectionRowKind(kind) {
    const normalized = `${kind ?? ''}`.trim().toLowerCase();
    return normalized !== '' && normalized !== 'page';
}
