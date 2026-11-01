import {
    buildBreadcrumbRowHref,
    buildCollectionPageHref,
    buildCollectionSortToggleHref,
    getCollectionSortState,
    readRequestedSortState,
} from './breadcrumb-items.js';
import { sortItemsRows } from './collection-items.js';
import { normalizePathname } from './navigation-state.js';
import { initAutoScrollbar } from './auto-scrollbar.js';
import { readCollectionSortCopy, formatSortAction } from './collection-sort-copy.js';

export function updateCollectionColumnHeader(header, source, state, lineageLogicalPath) {
    const copy = readCollectionSortCopy();
    header.querySelector('.path-column-label').href = buildCollectionPageHref(
        source.href, source.logicalPath, state.sortVariant, state.defaultSort
    );
    const toggle = header.querySelector('[data-collection-sort-toggle]');
    toggle.href = buildCollectionSortToggleHref(source, window.location.href, lineageLogicalPath);
    const fieldLabel = copy.fields[state.field] || state.field;
    const actionLabel = formatSortAction(copy, state.field, state.order === 'asc' ? 'desc' : 'asc');
    toggle.title = actionLabel;
    toggle.setAttribute('aria-label', actionLabel);
    toggle.querySelector('.path-sort-label').textContent = fieldLabel;
    toggle.querySelector('[data-sort-indicator]').textContent = state.order === 'asc' ? '↑' : '↓';
}

export function renderPathColumn(column, payload, { selectedPathname = '', lineageLogicalPath = '' } = {}) {
    if (!(column instanceof Element) || !payload?.template) return;
    const list = payload.template.content.firstElementChild.cloneNode(true);
    const elements = [...list.querySelectorAll('[data-list-item]')];
    const state = getCollectionSortState(payload);
    const linkState = state || readRequestedSortState(payload, '', '');
    const { rows } = sortItemsRows(payload.rows, payload.sortVariant, payload.logicalPath, payload.defaultSort);
    const ordered = document.createDocumentFragment();
    for (const row of rows) {
        const element = elements[row._originalIndex];
        const link = element.querySelector('a[data-list-entry]');
        link.href = buildBreadcrumbRowHref(row, payload, linkState);
        const current = selectedPathname && normalizePathname(new URL(row.href, window.location.origin).pathname) === selectedPathname;
        link.classList.toggle('is-current', !!current);
        if (current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
        ordered.appendChild(element);
    }
    list.appendChild(ordered);
    if (state) updateCollectionColumnHeader(list.querySelector('[data-list-header]'), payload, state, lineageLogicalPath);
    column.removeAttribute('data-navigation-failed');
    column.dataset.navigationColumn = payload.logicalPath;
    column.dataset.sortVariant = payload.sortVariant;
    column.dataset.defaultSort = payload.defaultSort;
    column.dataset.breadcrumbCollectionHref = payload.href;
    initAutoScrollbar(column);
    column.replaceChildren(list);
}

function fillPathColumn(column, model, error) {
    column.dataset.navigationColumn = model.key;
    column.toggleAttribute('data-navigation-failed', model.failed === true);
    if (model.failed) {
        delete column.dataset.breadcrumbCollectionHref;
        delete column.dataset.sortVariant;
        delete column.dataset.defaultSort;
        const message = document.createElement('p');
        message.setAttribute('role', 'status');
        message.textContent = error;
        column.replaceChildren(message);
        return;
    }
    renderPathColumn(column, model.payload, { selectedPathname: model.selectedPathname });
}

export function renderPathColumns(models, error = '') {
    const nav = document.querySelector('[data-slot="breadcrumb"]');
    if (!nav || !Array.isArray(models)) return false;
    // Keep the reserved scroll containers attached. Replacing them resets the
    // horizontal canvas in WebKit even when the new columns have identical sizes.
    const columns = Array.from(nav.children);
    models.forEach((model, index) => {
        let column = columns[index];
        if (!column) {
            column = document.createElement('div');
            column.className = 'page-column path-column';
            column.dataset.collectionColumn = 'true';
            nav.appendChild(column);
        }
        fillPathColumn(column, model, error);
    });
    columns.slice(models.length).forEach(column => column.remove());
    nav.setAttribute('aria-label', 'Breadcrumb');
    nav.removeAttribute('aria-hidden');
    return true;
}
