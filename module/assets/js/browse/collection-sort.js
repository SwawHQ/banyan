import {
    SORT_VARIANTS,
    applySortTokenToUrl,
    compareSortRecords,
    parseSortToken,
    readCurrentSortToken,
    toggleSortOrder
} from './sort-policy.js';
import { readPageCollectionSource } from './collection-source.js';
import { refreshCollectionNavigation } from './collection-navigation.js';

function writeSortToken(token, defaultToken) {
    const url = new URL(window.location.href);
    applySortTokenToUrl(url, token, defaultToken);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function readRowValue(row, fieldConfig) {
    if (!row || !fieldConfig) return '';
    return row.dataset?.[fieldConfig.dataKey] ?? '';
}

function readRowGroup(row) {
    return row?.dataset?.sortGroup ?? 0;
}

function readRowStableKey(row) {
    const href = row
        ?.querySelector('[data-list-entry][href]')
        ?.getAttribute('href') || '';
    if (!href) {
        return '';
    }

    try {
        return new URL(href, window.location.href).pathname;
    } catch (error) {
        return href.split(/[?#]/, 1)[0];
    }
}

function applySortableList(list) {
    const variantName = (list.dataset.sortVariant || '').toLowerCase();
    const variant = SORT_VARIANTS[variantName];
    if (!variant) return;

    const pageCollectionSource = readPageCollectionSource();
    const currentToken = readCurrentSortToken(variantName, variant.defaultToken);
    const current = parseSortToken(currentToken);
    if (!variant.fields[current.field]) return;

    const rows = Array.from(list.children).filter((child) => child.hasAttribute('data-list-item'));
    if (!rows.length) {
        refreshCollectionNavigation(list, variantName, currentToken, pageCollectionSource);
        return;
    }

    const sortedRows = rows.slice().sort((left, right) => {
        return compareSortRecords(left, right, {
            variant,
            field: current.field,
            order: current.order,
            readValue: readRowValue,
            readGroup: readRowGroup,
            readStableKey: readRowStableKey,
        });
    });

    const orderChanged = sortedRows.some((row, index) => row !== rows[index]);
    if (orderChanged) {
        const fragment = document.createDocumentFragment();
        sortedRows.forEach((row) => fragment.appendChild(row));
        list.appendChild(fragment);
    }

    refreshCollectionNavigation(list, variantName, currentToken, pageCollectionSource);
}

function applySortableLists() {
    const lists = Array.from(document.querySelectorAll('[data-sortable="true"][data-sort-variant]'));
    lists.forEach((list) => applySortableList(list));
}

function initSortableLists() {
    applySortableLists();

    document.addEventListener('click', (event) => {
        const control = event.target.closest('a[data-sort-control="true"]');
        if (!control) return;
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey
            || event.shiftKey || event.altKey || control.hasAttribute('download')
            || (control.target && control.target !== '_self')) return;

        const list = control.closest('[data-sortable="true"][data-sort-variant]');
        if (!list) return;

        const variantName = (list.dataset.sortVariant || '').toLowerCase();
        const variant = SORT_VARIANTS[variantName];
        const field = (control.dataset.sortField || '').toLowerCase();
        const defaultOrder = (control.dataset.sortDefaultOrder || 'asc').toLowerCase();
        const currentToken = readCurrentSortToken(variantName, variant?.defaultToken || '');
        const current = parseSortToken(currentToken);
        const nextOrder = current.field === field ? toggleSortOrder(current.order) : defaultOrder;
        const nextToken = `${field}-${nextOrder}`;

        if (!variant || !variant.fields[field]) return;

        event.preventDefault();
        writeSortToken(nextToken, variant.defaultToken);
        applySortableLists();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSortableLists();
});
window.addEventListener('hashchange', applySortableLists);
