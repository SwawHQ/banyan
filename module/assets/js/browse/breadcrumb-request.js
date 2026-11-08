export function breadcrumbRequests() {
    // The inline startup and deferred controller must share the same text promises.
    return document.banyanNavigationRequests ||= new Map();
}

export function requestBreadcrumbText(url) {
    if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin) throw new Error('Navigation data must be same-origin');
    const requests = breadcrumbRequests();
    if (!requests.has(url.href)) {
        const task = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(url.href, { signal: controller.signal, credentials: 'same-origin' });
                if (!response.ok) throw new Error('Navigation data request failed');
                return await response.text();
            } finally {
                clearTimeout(timer);
            }
        })();
        requests.set(url.href, task);
    }
    return requests.get(url.href);
}
