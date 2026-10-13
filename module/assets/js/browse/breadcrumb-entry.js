import {
    buildPathColumnItems,
    buildSelectedPathColumn,
} from './breadcrumb-items.js';
import { normalizeFromPath, normalizePathname, readCurrentFromPath } from './navigation-state.js';
import {
    pickSourceByLogicalPath,
    parseEntrySelection,
} from './entry-source.js';
import { readEntryBreadcrumbSources } from './breadcrumb-source.js';
import { readPageCollectionSource } from './collection-source.js';
import { renderPathColumns } from './path-render.js';
import { refreshBreadcrumbCollectionColumns } from './breadcrumb-column-sort.js';

const ENTRY_BREADCRUMB_PENDING_ATTR = 'data-entry-breadcrumb-pending';
const BREADCRUMB_SORT_PENDING_ATTR = 'data-breadcrumb-sort-pending';

function buildAncestorColumns(source) {
    return (source?.columns || []).map(column => {
        let selectedPathname = '';
        try {
            selectedPathname = normalizePathname(new URL(column.selected.href, window.location.origin).pathname);
        } catch (error) { }
        const items = column.payload
            ? buildPathColumnItems(column.payload, column.source, { selectedPathname })
            : column.items;
        return {
            source: column.source,
            items: items.length ? items : [{ ...column.selected, current: false }],
        };
    });
}

export function buildCurrentPathColumn(source, currentText, currentTitle, currentHref) {
    let selectedPathname = '';
    try {
        selectedPathname = normalizePathname(new URL(currentHref, window.location.origin).pathname);
    } catch (error) { }

    const selectedColumn = buildSelectedPathColumn(source, selectedPathname, currentTitle);
    if (selectedColumn) {
        return selectedColumn;
    }
    if (!currentText || !currentHref) {
        return null;
    }

    return {
        source: null,
        items: [{ text: currentText, title: currentTitle, href: currentHref, current: true }],
    };
}

function buildEntryColumns(source) {
    const columns = buildAncestorColumns(source);
    const body = document.body;
    const currentColumn = buildCurrentPathColumn(
        source,
        body?.dataset.currentPageText || document.title || '',
        body?.dataset.currentPageTitle || document.title || '',
        `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    if (currentColumn) {
        columns.push(currentColumn);
    }
    return columns;
}

function buildCollectionPathColumns(sources, requiredAncestorPath = '') {
    const pageCollectionSource = readPageCollectionSource();
    const requiredAncestor = normalizeFromPath(requiredAncestorPath);
    if (
        requiredAncestor
        && !pageCollectionSource?.logicalPath?.startsWith(requiredAncestor)
    ) {
        return [];
    }
    const source = pageCollectionSource
        ? pickSourceByLogicalPath(sources, pageCollectionSource.logicalPath)
        : null;
    return source ? buildAncestorColumns(source) : [];
}

function clearPending(name) {
    document.documentElement?.removeAttribute(name);
}

export function initializeBreadcrumb() {
    const html = document.documentElement;
    const entryPending = html.getAttribute(ENTRY_BREADCRUMB_PENDING_ATTR) === 'true';
    const sortPending = html.getAttribute(BREADCRUMB_SORT_PENDING_ATTR) === 'true';
    const result = { entryRendered: false, sortRendered: false };
    if (!entryPending && !sortPending) {
        return result;
    }

    try {
        const sources = readEntryBreadcrumbSources();
        if (entryPending) {
            const fromPath = readCurrentFromPath();
            const selection = parseEntrySelection(sources, fromPath);
            // A collection URL may name its ancestor in `from` while its source model is
            // keyed by the current collection. In that case only its ancestor columns
            // belong in the path; the current collection is already the main column.
            const columns = selection
                ? buildEntryColumns(selection.source)
                : buildCollectionPathColumns(sources, fromPath);
            result.entryRendered = renderPathColumns(columns);
        }

        if (sortPending) {
            refreshBreadcrumbCollectionColumns();
            result.sortRendered = true;
        }
    } finally {
        if (entryPending) clearPending(ENTRY_BREADCRUMB_PENDING_ATTR);
        if (sortPending) clearPending(BREADCRUMB_SORT_PENDING_ATTR);
    }

    return result;
}
