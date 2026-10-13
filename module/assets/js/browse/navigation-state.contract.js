export const ENTRY_LINEAGE_FIELD = 'from';
export const ACTIVE_SORT_FIELD = 'sort';
export const LINEAGE_SORTS_FIELD = 'sorts';
export const SORTS_PLACEHOLDER = '_';

export function readFragment(hash) {
    const raw = (hash instanceof URL ? hash.hash : hash || '').replace(/^#/, '');
    if (!raw || raw.includes('=')) return new URLSearchParams(raw);
    try {
        return new URLSearchParams({ anchor: decodeURIComponent(raw) });
    } catch {
        return new URLSearchParams();
    }
}

export function readFieldValue(hash, field) {
    return readFragment(hash).get(field) || '';
}

export function hasFieldValue(hash, field) {
    return readFragment(hash).has(field);
}

export function writeFragment(url, fields) {
    // Keep plain chapter links native when there is no other fragment state.
    if (fields.size === 1 && fields.has('anchor')) {
        url.hash = encodeURIComponent(fields.get('anchor'));
    } else {
        url.hash = fields.toString().replace(/%2F/gi, '/').replace(/%2C/gi, ',');
    }
    return url;
}

export function applyFragmentField(url, field, value) {
    const fields = readFragment(url);
    if (value) fields.set(field, value);
    else fields.delete(field);
    return writeFragment(url, fields);
}

export function readAnchor(hash) {
    return readFieldValue(hash, 'anchor');
}
