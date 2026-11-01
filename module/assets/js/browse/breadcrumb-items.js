import { normalizeCollectionSource } from './collection-source.js';
import { readNavigation } from './entry-source.js';
import {
    SORT_VARIANTS,
    applySortTokenToUrl,
    getNormalizedSortToken,
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
    buildDefaultSortsTokens,
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
        ? buildCurrentPageSortsTokens(source.logicalPath, sortToken)
        : [];
    const defaultSortsTokens = source?.logicalPath
        ? buildDefaultSortsTokens(source.logicalPath, fallbackToken)
        : [];

    return {
        sortToken,
        defaultSort: fallbackToken,
        sortsTokens,
        defaultSortsTokens,
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
    const sortToken = getNormalizedSortToken(
        requestedState.sortToken,
        sortVariant,
        defaultSort
    );
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
        const defaultLineagePath = readNavigation()?.default || '';
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
            buildLineageSortsTokensForPath(lineageLogicalPath, targetLogicalPath, state.nextToken),
            buildDefaultSortsTokens(lineageLogicalPath, state.defaultSort)
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
        const sortsTokens = buildCurrentPageSortsTokens(logicalPath, sortToken);
        applySortTokenToUrl(url, sortToken, defaultSort);
        applySortsTokensToUrl(url, sortsTokens, buildDefaultSortsTokens(logicalPath, defaultSort));
        return toRelativeHref(url);
    } catch (error) {
        return rawHref;
    }
}

export function applyBreadcrumbRowSort(url, row, collectionSource, sortState = {}) {
    const { sortToken = '', defaultSort = '', sortsTokens = [], defaultSortsTokens = [] } = sortState;
    const logicalPath = collectionSource.logicalPath;
    const isCollection = isCollectionRowKind(row.kind);
    applySortTokenToUrl(url, sortToken, defaultSort);
    applySortsTokensToUrl(
        url,
        isCollection ? buildDescendantSortsTokens(logicalPath, sortToken) : sortsTokens,
        isCollection ? buildDefaultSortsTokens(logicalPath, defaultSort, 1)
            : defaultSortsTokens.length ? defaultSortsTokens : buildDefaultSortsTokens(logicalPath, defaultSort)
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
