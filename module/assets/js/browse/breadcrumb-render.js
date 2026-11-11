import {
    buildBreadcrumbRowHref,
    buildBreadcrumbSortToggleHref,
    getBreadcrumbSortState,
    readRequestedSortState,
} from './breadcrumb-links.js';
import { sortItemsRows } from './collection-items.js';
import { normalizePathname } from './navigation-state.js';
import { initAutoScrollbar } from './auto-scrollbar.js';
import { readCollectionSortCopy, formatSortAction } from './collection-sort-copy.js';

export function updateBreadcrumbColumnHeader(header, source, state, lineageLogicalPath) {
    const copy = readCollectionSortCopy();
    const toggle = header.querySelector('[data-breadcrumb-sort-toggle]');
    toggle.href = buildBreadcrumbSortToggleHref(source, window.location.href, lineageLogicalPath);
    const fieldLabel = copy.fields[state.field] || state.field;
    const actionLabel = formatSortAction(copy, state.field, state.order === 'asc' ? 'desc' : 'asc');
    toggle.title = actionLabel;
    toggle.setAttribute('aria-label', actionLabel);
    toggle.querySelector('.breadcrumb-sort-label').textContent = fieldLabel;
    toggle.querySelector('[data-sort-indicator]').textContent = state.order === 'asc' ? '↑' : '↓';
}

export function renderBreadcrumbColumn(column, payload, { selectedPathname = '', lineageLogicalPath = '' } = {}) {
    if (!(column instanceof Element) || !payload?.template) return;
    const list = payload.template.content.firstElementChild.cloneNode(true);
    const elements = [...list.querySelectorAll('[data-list-item]')];
    const state = getBreadcrumbSortState(payload);
    const linkState = state || readRequestedSortState(payload, '', '');
    // Hugo has already ordered the fragment for its default sort.
    const reordered = state && state.sortToken !== payload.defaultSort;
    const rows = reordered
        ? sortItemsRows(payload.rows, payload.sortVariant, payload.logicalPath, payload.defaultSort).rows : payload.rows;
    const ordered = reordered ? document.createDocumentFragment() : null;
    for (const row of rows) {
        const element = elements[row._originalIndex];
        const link = element.querySelector('a[data-list-entry]');
        link.href = buildBreadcrumbRowHref(row, payload, linkState);
        const current = selectedPathname && normalizePathname(new URL(row.href, window.location.origin).pathname) === selectedPathname;
        link.classList.toggle('is-current', !!current);
        if (current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
        ordered?.appendChild(element);
    }
    if (ordered) list.appendChild(ordered);
    if (state) updateBreadcrumbColumnHeader(list.querySelector('[data-list-header]'), payload, state, lineageLogicalPath);
    column.removeAttribute('data-breadcrumb-failed');
    column.dataset.breadcrumbColumnPath = payload.logicalPath;
    column.dataset.sortVariant = payload.sortVariant;
    column.dataset.defaultSort = payload.defaultSort;
    column.dataset.breadcrumbCollectionHref = payload.href;
    column.tabIndex = 0;
    column.setAttribute('role', 'group');
    column.setAttribute('aria-label', list.getAttribute('aria-label'));
    initAutoScrollbar(column);
    column.replaceChildren(list);
}

export function fillBreadcrumbColumn(column, model, error = '', lineageLogicalPath = '') {
    column.dataset.breadcrumbColumnPath = model.key;
    column.toggleAttribute('data-breadcrumb-failed', !model.payload);
    if (!model.payload) {
        delete column.dataset.breadcrumbCollectionHref;
        delete column.dataset.sortVariant;
        delete column.dataset.defaultSort;
        const message = document.createElement('p');
        message.setAttribute('role', 'status');
        message.textContent = error;
        column.replaceChildren(message);
        return;
    }
    const selectedPathname = normalizePathname(new URL(model.selected, window.location.origin).pathname);
    renderBreadcrumbColumn(column, model.payload, { selectedPathname, lineageLogicalPath });
}

export function prepareBreadcrumbColumns(models) {
    const nav = document.querySelector('[data-slot="breadcrumb"]');
    if (!nav) return [];
    // Keep the reserved scroll containers attached. Replacing them resets the
    // horizontal canvas in WebKit even when the new columns have identical sizes.
    const columns = Array.from(nav.children);
    models.forEach((model, index) => {
        let column = columns[index];
        if (!column) {
            column = document.createElement('div');
            column.className = 'page-column breadcrumb-column';
            column.dataset.breadcrumbColumn = 'true';
            nav.appendChild(column);
        }
        if (column.dataset.breadcrumbColumnPath !== model.key) {
            column.replaceChildren();
            column.removeAttribute('tabindex');
            column.removeAttribute('aria-label');
            column.removeAttribute('data-breadcrumb-failed');
            delete column.dataset.breadcrumbCollectionHref;
            delete column.dataset.sortVariant;
            delete column.dataset.defaultSort;
            column.dataset.breadcrumbColumnPath = model.key;
        }
    });
    columns.slice(models.length).forEach(column => column.remove());
    nav.setAttribute('aria-label', 'Breadcrumb');
    nav.removeAttribute('aria-hidden');
    return [...nav.children];
}
