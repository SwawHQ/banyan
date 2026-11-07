import { normalizeCollectionSource } from './collection-source.js';
import { readNavigation } from './entry-source.js';
import {
    SORT_VARIANTS,
    parseSortToken,
    toggleSortOrder,
} from './sort-policy.js';
import {
    isCollectionRowKind,
    readRequestedSortToken,
} from './collection-items.js';
import {
    applyFromPathToUrl,
    applySortsTokensToUrl,
    buildCurrentPageSortsTokens,
    buildDescendantSortsTokens,
    buildLineageSortsTokensForPath,
    normalizeFromPath,
    readCurrentFromPath,
} from './navigation-state.js';

function toRelativeHref(url) {
    if (!(url instanceof URL)) {
        return '';
    }

    return url.origin === window.location.origin
        ? `${url.pathname}${url.search}${url.hash}`
        : url.toString();
}

export function readRequestedSortState(source, sortVariant, defaultSort = '') {
    const fallbackToken = defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken || '';
    const sortToken = sortVariant ? readRequestedSortToken(sortVariant, source?.logicalPath || '', fallbackToken) : '';
    const sortsTokens = source?.logicalPath
        ? buildCurrentPageSortsTokens(source.logicalPath, sortToken, fallbackToken)
        : [];

    return {
        sortToken,
        defaultSort: fallbackToken,
        sortsTokens,
    };
}

export function getCollectionSortState(source) {
    const collectionSource = normalizeCollectionSource(source);
    if (!collectionSource?.logicalPath) {
        return null;
    }

    const sortVariant = collectionSource.sortVariant || '';
    const defaultSort = collectionSource.defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken || '';
    const requestedState = readRequestedSortState(collectionSource, sortVariant, defaultSort);
    const sortToken = requestedState.sortToken;
    const current = parseSortToken(sortToken);
    if (!current.field || !current.order) {
        return null;
    }

    return {
        ...requestedState,
        collectionSource,
        sortVariant,
        sortToken,
        field: current.field,
        order: current.order,
        nextToken: `${current.field}-${toggleSortOrder(current.order)}`,
    };
}

export function buildCollectionSortToggleHref(
    source,
    baseHref = window.location.href,
    lineagePathOverride = ''
) {
    const state = getCollectionSortState(source);
    if (!state) {
        return '';
    }

    try {
        const url = new URL(baseHref, window.location.origin);
        const currentLineagePath = readCurrentFromPath();
        const defaultLineagePath = normalizeFromPath(document.body?.dataset.collectionPath)
            || readNavigation()?.default || '';
        const targetLogicalPath = state.collectionSource.logicalPath;
        const lineageLogicalPath = normalizeFromPath(lineagePathOverride)
            || currentLineagePath
            || defaultLineagePath
            || targetLogicalPath;

        if (!currentLineagePath && lineageLogicalPath !== defaultLineagePath) {
            applyFromPathToUrl(url, lineageLogicalPath);
        }
        applySortsTokensToUrl(
            url,
            buildLineageSortsTokensForPath(lineageLogicalPath, targetLogicalPath, state.nextToken, state.defaultSort)
        );
        return toRelativeHref(url);
    } catch (error) {
        return '';
    }
}

export function buildCollectionPageHref(href, logicalPath, sortVariant, defaultSort = '') {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref || !logicalPath || !sortVariant) {
        return rawHref;
    }

    try {
        const url = new URL(rawHref, window.location.origin);
        const sortToken = readRequestedSortToken(sortVariant, logicalPath, defaultSort);
        const sortsTokens = buildCurrentPageSortsTokens(logicalPath, sortToken, defaultSort || SORT_VARIANTS[sortVariant]?.defaultToken);
        applySortsTokensToUrl(url, sortsTokens);
        return toRelativeHref(url);
    } catch (error) {
        return rawHref;
    }
}

export function applyBreadcrumbRowSort(url, row, collectionSource, sortState = {}) {
    const { sortToken = '', defaultSort = '', sortsTokens = [] } = sortState;
    const logicalPath = collectionSource.logicalPath;
    const isCollection = isCollectionRowKind(row.kind);
    applySortsTokensToUrl(
        url,
        isCollection ? buildDescendantSortsTokens(logicalPath, sortToken, defaultSort, row.sort_variant, row.default_sort) : sortsTokens
    );
}

export function buildBreadcrumbRowHref(row, collectionSource, sortState) {
    if (!row || typeof row.href !== 'string' || row.href.trim() === '' || !collectionSource?.logicalPath) {
        return '';
    }

    try {
        const url = new URL(row.href, window.location.origin);
        applyBreadcrumbRowSort(url, row, collectionSource, sortState);
        return toRelativeHref(url);
    } catch (error) {
        return row.href;
    }
}
