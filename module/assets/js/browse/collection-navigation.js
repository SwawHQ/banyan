import {
    SORT_VARIANTS,
    parseSortToken,
    toggleSortOrder,
} from './sort-policy.js';
import {
    applySortsTokensToUrl,
    buildCurrentPageSortsTokens,
    buildDescendantSortsTokens,
} from './navigation-state.js';
import { readRequestedSortToken } from './collection-items.js';
import { readPageCollectionSource } from './collection-source.js';
import { readCollectionSortCopy, formatSortAction } from './collection-sort-copy.js';

function buildSortHref(token, defaultToken) {
    const url = new URL(window.location.href);
    const source = readPageCollectionSource();
    if (!source) return '';
    applySortsTokensToUrl(url, buildCurrentPageSortsTokens(source.logicalPath, token, defaultToken));
    return `${url.pathname}${url.search}${url.hash}`;
}

function buildRelativeHref(url) {
    if (!(url instanceof URL)) return '';
    return url.origin === window.location.origin
        ? `${url.pathname}${url.search}${url.hash}`
        : url.toString();
}

function updateCollectionEntryLinks(list, variantName, currentToken, pageCollectionSource) {
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return;

    const currentSorts = pageCollectionSource?.logicalPath
        ? buildCurrentPageSortsTokens(pageCollectionSource.logicalPath, currentToken, variant.defaultToken)
        : [];
    const descendantSorts = pageCollectionSource?.logicalPath
        ? buildDescendantSortsTokens(pageCollectionSource.logicalPath, currentToken, variant.defaultToken)
        : [];

    list.querySelectorAll('[data-list-item] > [data-list-entry][href]').forEach((link) => {
        const rawHref = link.getAttribute('href') || '';
        if (!rawHref) return;

        let url;
        try {
            url = new URL(rawHref, window.location.origin);
        } catch (error) {
            return;
        }
        if (url.origin !== window.location.origin) return;

        if (pageCollectionSource?.logicalPath) {
            const isEntryLink = link.parentElement.dataset.kind === 'page';
            applySortsTokensToUrl(
                url,
                isEntryLink ? currentSorts : descendantSorts
            );
        }
        link.href = buildRelativeHref(url);
    });
}

function updateCollectionSortControls(list, variantName, currentToken) {
    const variant = SORT_VARIANTS[variantName];
    const current = parseSortToken(currentToken);
    if (!variant || !current) return;
    const copy = readCollectionSortCopy();

    list.querySelectorAll('a[data-sort-control="true"]').forEach((control) => {
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const active = field === current.field;
        const nextOrder = active ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;
        const indicator = control.querySelector('[data-sort-indicator]');
        const actionLabel = formatSortAction(copy, field, nextOrder);

        control.href = buildSortHref(nextToken, variant.defaultToken);
        control.dataset.sortActive = active ? 'true' : 'false';
        if (actionLabel) {
            control.title = actionLabel;
            control.setAttribute('aria-label', actionLabel);
        }
        if (indicator) {
            indicator.textContent = active ? (current.order === 'asc' ? '↑' : '↓') : '↨';
        }
    });
}

export function refreshCollectionNavigation(list, variantName, currentToken, pageCollectionSource) {
    if (!(list instanceof Element)) return;
    updateCollectionSortControls(list, variantName, currentToken);
    updateCollectionEntryLinks(list, variantName, currentToken, pageCollectionSource);
}

export function refreshMainCollectionNavigation() {
    const list = document.querySelector('.slot-main [data-sortable="true"][data-sort-variant]');
    if (!(list instanceof Element)) return;

    const variantName = (list.dataset.sortVariant || '').toLowerCase();
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return;

    const source = readPageCollectionSource();
    const currentToken = readRequestedSortToken(variantName, source?.logicalPath, variant.defaultToken);
    refreshCollectionNavigation(list, variantName, currentToken, source);
}
