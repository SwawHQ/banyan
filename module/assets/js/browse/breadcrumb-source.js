import { decodeItemsPayload } from './collection-items.js';
import { normalizeFromPath } from './navigation-state.js';
import { readNavigation, readActiveNavigationRoute } from './entry-source.js';

const loadedColumns = new Map();
const loadingColumns = new Map();

function isLocalLink(href, allowEmpty = false) {
    if (allowEmpty && href === '') return true;
    if (typeof href !== 'string' || !href.trim()) return false;
    try {
        const url = new URL(href, window.location.href);
        return /^https?:$/.test(url.protocol) && url.origin === window.location.origin;
    } catch (_) {
        return false;
    }
}

export function readBreadcrumbColumn(logicalPath) {
    const key = normalizeFromPath(logicalPath);
    const navigation = readNavigation();
    const hash = navigation?.columns[key]?.hash;
    const url = typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
        ? `${navigation.resources}${hash}.json` : '';
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
                const raw = await response.json();
                const payload = decodeItemsPayload(raw);
                if (raw?.v !== 1 || !payload || payload.provider !== 'collection' || payload.logicalPath !== column.key
                    || typeof raw.label !== 'string' || !raw.label.trim() || !isLocalLink(raw.href, true)
                    || payload.rows.some(row => !isLocalLink(row.href))) {
                    throw new Error('Navigation data does not match its column');
                }
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
