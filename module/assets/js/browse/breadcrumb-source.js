import { normalizeFromPath } from './navigation-state.js';
import { readNavigation, readActiveNavigationRoute } from './entry-source.js';
import { SORT_VARIANTS } from './sort-policy.js';

const loadedColumns = new Map();
const loadingColumns = new Map();

function isLocalLink(href) {
    if (typeof href !== 'string' || !href.trim()) return false;
    try {
        const url = new URL(href, window.location.href);
        return /^https?:$/.test(url.protocol) && url.origin === window.location.origin;
    } catch (_) {
        return false;
    }
}

function readColumnFragment(text, logicalPath) {
    const template = document.createElement('template');
    template.innerHTML = text;
    const list = template.content.firstElementChild;
    const invalid = () => { throw new Error('Navigation fragment does not match its column'); };
    if (template.content.children.length !== 1
        || [...template.content.childNodes].some(node => node.nodeType !== 1 && node.textContent.trim())
        || !list.matches('div.item-list.item-list--path-column')
        || normalizeFromPath(list.dataset.navigationColumn) !== logicalPath) invalid();
    // Keep downloaded markup passive before any cloned nodes enter the page.
    for (const node of [list, ...list.querySelectorAll('*')]) {
        if (!['div', 'span', 'a', 'bdi', 'svg', 'use', 'img'].includes(node.localName)) invalid();
        for (const attribute of node.attributes) {
            if (!/^(?:class|href|title|role|aria-[\w-]+|data-[\w-]+|width|height|focusable|alt|decoding|src)$/.test(attribute.name)) invalid();
            if (attribute.name === 'href' && (!['a', 'use'].includes(node.localName)
                || !isLocalLink(attribute.value) || (node.localName === 'use' && !attribute.value.startsWith('#')))) invalid();
            if (attribute.name === 'src' && (node.localName !== 'img'
                || !/^\/(?!\/)/.test(attribute.value) || !isLocalLink(attribute.value))) invalid();
        }
    }
    const header = list.firstElementChild;
    const label = header?.querySelector('a.path-column-label[href]');
    const sortVariant = list.dataset.sortVariant || '';
    const defaultSort = list.dataset.defaultSort || '';
    if (!header?.matches('div[data-list-header]') || !label?.textContent.trim()
        || !isLocalLink(label.getAttribute('href'))
        || (sortVariant && (!SORT_VARIANTS[sortVariant]
            || !SORT_VARIANTS[sortVariant].fields[defaultSort.split('-')[0]]
            || !/^[a-z]+-(?:asc|desc)$/.test(defaultSort)))
        || (!sortVariant && defaultSort)) invalid();
    const toggle = header.querySelector('a[data-collection-sort-toggle]');
    if (sortVariant && (!toggle?.querySelector('.path-sort-label')
        || !toggle.querySelector('[data-sort-indicator]'))) invalid();
    const rows = [...list.children].slice(1).map((node, index) => {
        const link = node.firstElementChild;
        if (!node.matches('div[data-list-item]') || node.children.length !== 1
            || !link?.matches('a[data-list-entry][href]') || !node.dataset.kind
            || !link.querySelector('.item-title > bdi')?.textContent.trim()
            || !isLocalLink(link.getAttribute('href'))) invalid();
        const row = { kind: node.dataset.kind, href: link.getAttribute('href'), _originalIndex: index };
        for (const [key, value] of Object.entries(node.dataset)) {
            if (key.startsWith('sort')) row[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = value;
        }
        return row;
    });
    if (list.querySelectorAll('[data-list-item]').length !== rows.length
        || list.querySelectorAll('[data-list-entry]').length !== rows.length
        || new Set(rows.map(row => row.href)).size !== rows.length) invalid();
    return { provider: 'collection', logicalPath, label: label.textContent.trim(),
        href: label.getAttribute('href'), sortVariant, defaultSort, rows, template };
}

export function readBreadcrumbColumn(logicalPath) {
    const key = normalizeFromPath(logicalPath);
    const navigation = readNavigation();
    const hash = navigation?.columns[key]?.hash;
    const url = typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
        ? `${navigation.resources}${hash}.txt` : '';
    const cached = loadedColumns.get(url);
    const payload = cached?.logicalPath === key ? cached : null;
    return { key, url, payload, source: payload };
}

export function readBreadcrumbColumns() {
    return readActiveNavigationRoute().columns.map(column => ({
        ...readBreadcrumbColumn(column.column),
        selected: column.selected || window.location.pathname,
    }));
}

async function loadColumn(column) {
    const key = column.url;
    if (!key) throw new Error('Missing navigation resource');
    if (loadedColumns.get(key)?.logicalPath === column.key) return;
    const url = new URL(key, window.location.href);
    if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin) throw new Error('Navigation data must be same-origin');
    if (!loadingColumns.has(key)) {
        const task = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(url.href, { signal: controller.signal, credentials: 'same-origin' });
                if (!response.ok) throw new Error('Navigation data request failed');
                const payload = readColumnFragment(await response.text(), column.key);
                loadedColumns.set(key, payload);
            } finally {
                clearTimeout(timer);
                loadingColumns.delete(key);
            }
        })();
        loadingColumns.set(key, task);
    }
    await loadingColumns.get(key);
}

export function loadBreadcrumbColumns(columns) {
    // Keep successful columns available when another column fails or needs a retry.
    return Promise.allSettled(columns.map(loadColumn));
}
