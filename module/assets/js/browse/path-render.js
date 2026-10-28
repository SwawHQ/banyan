import {
    buildCollectionPageHref,
    buildCollectionSortToggleHref,
    getCollectionSortState,
} from './breadcrumb-items.js';
import { normalizeCollectionSource } from './collection-source.js';
import { normalizeIcon } from './icon-value.js';
import { initAutoScrollbar } from './auto-scrollbar.js';

function normalizeBreadcrumbItemKind(item) {
    const kind = item && typeof item.kind === 'string' ? item.kind.trim().toLowerCase() : '';
    return kind || '';
}

function buildCollectionItemContent(item) {
    const fragment = document.createDocumentFragment();
    const kind = normalizeBreadcrumbItemKind(item);
    const value = normalizeIcon(item?.icon) || (kind && kind !== 'page' ? 'folder' : 'file');
    const icon = document.createElement('span');
    icon.className = 'item-icon';
    if (typeof value === 'object' && value.image) {
        icon.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.className = 'icon icon--image';
        if (value.monochrome) image.classList.add('icon--monochrome');
        image.src = value.image;
        image.alt = '';
        image.width = 16;
        image.height = 16;
        image.decoding = 'async';
        image.setAttribute('aria-hidden', 'true');
        icon.appendChild(image);
    } else if (typeof value === 'object') {
        icon.classList.add('item-icon--text');
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.className = 'icon icon--text';
        text.setAttribute('aria-hidden', 'true');
        text.textContent = value.text;
        icon.appendChild(text);
    } else {
        const iconName = value;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('icon', `icon-${iconName}`);
        svg.setAttribute('width', '1em');
        svg.setAttribute('height', '1em');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#icon-${iconName}`);
        svg.appendChild(use);
        icon.appendChild(svg);
    }

    const title = document.createElement('span');
    title.className = 'item-title';
    const text = document.createElement('bdi');
    text.textContent = item?.text || '';
    title.appendChild(text);
    fragment.append(icon, title);
    return fragment;
}

function readCollectionSortCopy() {
    const rawCopy = document.body?.dataset.collectionSortCopy || '';
    if (!rawCopy) {
        return { fields: {}, actions: {} };
    }

    try {
        const copy = JSON.parse(rawCopy);
        return {
            fields: copy?.fields && typeof copy.fields === 'object' ? copy.fields : {},
            actions: copy?.actions && typeof copy.actions === 'object' ? copy.actions : {},
        };
    } catch (error) {
        return { fields: {}, actions: {} };
    }
}

function buildCollectionColumnHeader(source, { lineageLogicalPath = '' } = {}) {
    const collectionSource = normalizeCollectionSource(source);
    if (!collectionSource?.label || !collectionSource?.href) {
        return null;
    }

    const header = document.createElement('div');
    header.className = 'list-item list-header list-header--path';
    header.dataset.listHeader = '';
    const field = document.createElement('span');
    field.className = 'item-field item-field--name';
    field.dataset.itemField = 'name';
    header.appendChild(field);
    const label = document.createElement('a');
    label.className = 'path-column-label';
    label.href = collectionSource.href;
    label.title = collectionSource.label;
    const labelText = document.createElement('bdi');
    labelText.textContent = collectionSource.label;
    label.appendChild(labelText);
    field.appendChild(label);

    const state = getCollectionSortState(collectionSource);
    if (!state) {
        return header;
    }
    const separator = document.createElement('span');
    separator.className = 'path-column-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '·';

    const toggle = document.createElement('a');
    toggle.className = 'path-column-sort';
    toggle.dataset.collectionSortToggle = 'true';

    const sortLabel = document.createElement('span');
    sortLabel.className = 'path-sort-label';
    const indicator = document.createElement('span');
    indicator.className = 'list-sort-indicator';
    indicator.dataset.sortIndicator = '';
    indicator.setAttribute('aria-hidden', 'true');
    toggle.append(sortLabel, indicator);
    field.append(separator, toggle);
    updateCollectionColumnHeader(header, collectionSource, state, lineageLogicalPath);
    return header;
}

export function updateCollectionColumnHeader(header, source, state, lineageLogicalPath) {
    const copy = readCollectionSortCopy();
    header.querySelector('.path-column-label').href = buildCollectionPageHref(
        source.href, source.logicalPath, state.sortVariant, state.defaultSort
    );
    const toggle = header.querySelector('[data-collection-sort-toggle]');
    toggle.href = buildCollectionSortToggleHref(source, window.location.href, lineageLogicalPath);
    const actionLabel = copy.actions[state.nextToken] || state.nextToken;
    toggle.title = actionLabel;
    toggle.setAttribute('aria-label', actionLabel);
    toggle.querySelector('.path-sort-label').textContent = copy.fields[state.field] || state.field;
    toggle.querySelector('[data-sort-indicator]').textContent = state.order === 'asc' ? '↑' : '↓';
}

function buildListItem(item, current) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.dataset.listItem = '';
    const option = document.createElement('a');
    option.href = item.href;
    option.className = current
        ? 'item-control item-field item-field--name is-current'
        : 'item-control item-field item-field--name';
    option.dataset.itemField = 'name';
    option.dataset.listEntry = '';
    if (current) {
        option.setAttribute('aria-current', 'page');
    }
    option.title = item.title || item.text || '';
    option.appendChild(buildCollectionItemContent(item));
    row.appendChild(option);
    return row;
}

function buildCollectionColumnList(items, collectionSource, options = {}) {
    const list = document.createElement('div');
    list.className = 'item-list item-list--path-column';
    const header = buildCollectionColumnHeader(collectionSource, options);
    if (header) {
        list.appendChild(header);
    }
    items.forEach((item) => {
        list.appendChild(buildListItem(item, item.current === true));
    });
    return list;
}

export function renderPathColumn(
    column,
    items,
    collectionSource = null,
    options = {}
) {
    if (!(column instanceof Element) || !Array.isArray(items)) {
        return;
    }

    initAutoScrollbar(column);
    column.replaceChildren(buildCollectionColumnList(items, collectionSource, options));
}

function fillPathColumn(column, model) {
    const collectionHref = model.source?.href || '';
    if (collectionHref) {
        column.dataset.breadcrumbCollectionHref = collectionHref;
    } else {
        delete column.dataset.breadcrumbCollectionHref;
    }
    renderPathColumn(column, model.items, model.source);
}

export function renderPathColumns(models) {
    const nav = document.querySelector('[data-slot="breadcrumb"]');
    if (!nav || !Array.isArray(models) || models.length === 0) {
        return false;
    }

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
        fillPathColumn(column, model);
    });
    columns.slice(models.length).forEach(column => column.remove());

    nav.setAttribute('aria-label', 'Breadcrumb');
    nav.removeAttribute('aria-hidden');
    return true;
}
