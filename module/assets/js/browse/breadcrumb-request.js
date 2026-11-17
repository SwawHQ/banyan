export function breadcrumbRequests() {
    // The inline startup and deferred controller must share the same text promises.
    return document.banyanBreadcrumbRequests ||= new Map();
}

export function requestBreadcrumbText(url, blockRendering = false) {
    if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin
        || !/\/[a-f0-9]{64}\.js$/.test(url.pathname) || url.search || url.hash) throw new Error('Invalid navigation resource');
    const requests = breadcrumbRequests();
    if (!requests.has(url.href)) {
        const task = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url.href;
            script.async = true;
            if (blockRendering) script.setAttribute('blocking', 'render');
            const hash = url.pathname.slice(-67, -3);
            script.integrity = 'sha256-' + btoa(String.fromCharCode(...hash.match(/../g).map(byte => parseInt(byte, 16))));
            const finish = () => {
                clearTimeout(timer);
                script.removeAttribute('blocking');
                script.remove();
                script.onload = script.onerror = null;
                const fragments = document.banyanBreadcrumbFragments;
                const text = fragments?.get(url.href);
                fragments?.delete(url.href);
                // 首屏填充沿 Promise 微任务完成；另加网络等待或定时器会让绘制提前发生。
                if (typeof text === 'string') resolve(text);
                else reject(new Error('Navigation data request failed'));
            };
            const timer = setTimeout(finish, 8000);
            script.onload = script.onerror = finish;
            document.head.appendChild(script);
        });
        requests.set(url.href, task);
    }
    return requests.get(url.href);
}
