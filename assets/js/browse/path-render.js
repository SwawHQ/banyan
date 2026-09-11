import {
    buildCollectionPageHref,
    buildCollectionSortToggleHref,
    getCollectionSortState,
    normalizeBreadcrumbCollectionSource,
} from './breadcrumb-items.js';
import { normalizeIcon } from './icon-value.js';

const PATH_PREFETCH_SLOT = 'crumb';

function normalizeBreadcrumbItemKind(item) {
    const kind = item && typeof item.kind === 'string' ? item.kind.trim().toLowerCase() : '';
    return kind || '';
}

function applyBreadcrumbPrefetchSlot(element) {
    if (element instanceof Element) {
        element.dataset.prefetchSlot = PATH_PREFETCH_SLOT;
    }
}

function buildCollectionItemContent(item) {
    const fragment = document.createDocumentFragment();
    const kind = normalizeBreadcrumbItemKind(item);
    const value = normalizeIcon(item?.icon) || (kind === 'page' ? 'file' : 'folder');
    const icon = document.createElement('span');
    icon.className = 'collection-item-icon';
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
        icon.classList.add('collection-item-icon--text');
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
    title.className = 'collection-item-title';
    title.textContent = item?.text || '';
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
    const collectionSource = normalizeBreadcrumbCollectionSource(source);
    if (!collectionSource?.label || !collectionSource?.href) {
        return null;
    }

    const header = document.createElement('span');
    header.className = 'collection-cell collection-cell--name collection-cell--header collection-header--path collection-header';
    header.dataset.collectionCell = 'name';
    header.dataset.collectionHeader = '';
    const label = document.createElement('a');
    label.className = 'collection-column-label';
    label.href = collectionSource.href;
    label.title = collectionSource.label;
    label.textContent = collectionSource.label;
    applyBreadcrumbPrefetchSlot(label);
    header.appendChild(label);

    const state = getCollectionSortState(collectionSource);
    if (!state) {
        return header;
    }
    const separator = document.createElement('span');
    separator.className = 'collection-column-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '·';

    const toggle = document.createElement('a');
    toggle.className = 'collection-column-sort';
    toggle.dataset.collectionSortToggle = 'true';
    applyBreadcrumbPrefetchSlot(toggle);

    const sortLabel = document.createElement('span');
    sortLabel.className = 'collection-sort-label';
    const indicator = document.createElement('span');
    indicator.className = 'collection-sort-indicator';
    indicator.dataset.sortIndicator = '';
    indicator.setAttribute('aria-hidden', 'true');
    toggle.append(sortLabel, indicator);
    header.append(separator, toggle);
    updateCollectionColumnHeader(header, collectionSource, state, lineageLogicalPath);
    return header;
}

export function updateCollectionColumnHeader(header, source, state, lineageLogicalPath) {
    const copy = readCollectionSortCopy();
    header.querySelector('.collection-column-label').href = buildCollectionPageHref(
        source.href, source.logicalPath, state.sortVariant, state.defaultSort
    );
    const toggle = header.querySelector('[data-collection-sort-toggle]');
    toggle.href = buildCollectionSortToggleHref(source, window.location.href, lineageLogicalPath);
    const actionLabel = copy.actions[state.nextToken] || state.nextToken;
    toggle.title = actionLabel;
    toggle.setAttribute('aria-label', actionLabel);
    toggle.querySelector('.collection-sort-label').textContent = copy.fields[state.field] || state.field;
    toggle.querySelector('[data-sort-indicator]').textContent = state.order === 'asc' ? '↑' : '↓';
}

function buildCollectionCell(item, current) {
    const cell = document.createElement('span');
    cell.className = 'collection-cell collection-cell--name';
    cell.dataset.collectionCell = 'name';
    const option = document.createElement('a');
    option.href = item.href;
    option.className = current
        ? 'collection-item-link is-current'
        : 'collection-item-link';
    option.dataset.collectionEntry = '';
    applyBreadcrumbPrefetchSlot(option);
    if (current) {
        option.setAttribute('aria-current', 'page');
    }
    option.title = item.title || item.text || '';
    option.appendChild(buildCollectionItemContent(item));
    cell.appendChild(option);
    return cell;
}

function buildCollectionColumnGrid(items, collectionSource, options = {}) {
    const grid = document.createElement('div');
    grid.className = 'collection-list collection-list--path-column';
    const header = buildCollectionColumnHeader(collectionSource, options);
    if (header) {
        grid.classList.add('collection-list--headed');
        grid.appendChild(header);
    }
    items.forEach((item) => {
        grid.appendChild(buildCollectionCell(item, item.current === true));
    });
    return grid;
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

    column.replaceChildren(buildCollectionColumnGrid(items, collectionSource, options));
}

function fillPathColumn(column, item) {
    const columnItems = Array.isArray(item.column_items) ? item.column_items.filter(Boolean) : [];
    const collectionSource = item.collection_source || item.collectionSource || {
        href: item.collection_href || '',
        label: item.collection_label || '',
    };
    const collectionHref = item.collection_href || item.collectionHref || collectionSource.href || '';
    if (collectionHref) {
        column.dataset.breadcrumbCollectionHref = collectionHref;
    } else {
        delete column.dataset.breadcrumbCollectionHref;
    }
    renderPathColumn(column, columnItems.length > 0 ? columnItems : [item], collectionSource);
}

export function renderPathColumns(items) {
    const nav = document.querySelector('.slot-breadcrumb .path-navigation');
    if (!nav || !Array.isArray(items) || items.length === 0) {
        return false;
    }

    // Keep the reserved scroll containers attached. Replacing them resets the
    // horizontal canvas in WebKit even when the new columns have identical sizes.
    const columns = Array.from(nav.children);
    items.forEach((item, index) => {
        let column = columns[index];
        if (!column) {
            column = document.createElement('div');
            column.className = 'path-column';
            column.dataset.collectionColumn = 'true';
            nav.appendChild(column);
        }
        fillPathColumn(column, item);
    });
    columns.slice(items.length).forEach(column => column.remove());

    nav.setAttribute('aria-label', 'Breadcrumb');
    nav.removeAttribute('aria-hidden');
    return true;
}
