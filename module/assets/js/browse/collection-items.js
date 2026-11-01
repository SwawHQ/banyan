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

function toRowSortKey(dataKey) {
    return String(dataKey || '')
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase();
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
