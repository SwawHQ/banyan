export const NAVIGATION_CACHE_PREFIX = 'nav-html-';
export const VERSIONED_ASSET_CACHE_PREFIX = 'asset-versioned-';
export const FINGERPRINT_ASSET_CACHE = 'asset-fingerprint';
export const CONTENT_STATE_CACHE = 'sw-content-state';
export const PROGRAM_OFFLINE_CACHE_PREFIX = 'sw-program-offline-';

export function isManagedCacheKey(key) {
    return key === FINGERPRINT_ASSET_CACHE
        || key === CONTENT_STATE_CACHE
        || key.startsWith(PROGRAM_OFFLINE_CACHE_PREFIX)
        || key.startsWith(NAVIGATION_CACHE_PREFIX)
        || key.startsWith(VERSIONED_ASSET_CACHE_PREFIX);
}

export function shouldDeleteVersionedCache(key, currentNavigationCache, currentAssetCache) {
    if (key.startsWith(NAVIGATION_CACHE_PREFIX)) return key !== currentNavigationCache;
    if (key.startsWith(VERSIONED_ASSET_CACHE_PREFIX)) return key !== currentAssetCache;
    return false;
}
