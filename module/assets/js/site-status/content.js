const indicator = document.querySelector('[data-site-content-status]');
const refresh = document.querySelector('[data-site-content-action="check"]');

async function checkContentVersion() {
    if (indicator.dataset.siteContentState === 'checking') return;
    const copy = JSON.parse(indicator.dataset.siteContentCopy);
    indicator.dataset.siteContentState = 'checking';
    indicator.textContent = copy.content_checking;
    refresh.disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(indicator.dataset.siteVersionUrl, {
            cache: 'no-store', credentials: 'same-origin', signal: controller.signal
        });
        if (!response.ok) throw new Error('Content version request failed.');
        const version = await response.json();
        if (typeof version !== 'string' || !version || version.length > 128
            || version.trim() !== version || /[\u0000-\u001f\u007f]/.test(version)) {
            throw new Error('Invalid content version.');
        }
        const matches = indicator.dataset.sitePageVersion === version;
        const value = document.createElement('bdi');
        value.textContent = version;
        const link = document.createElement('a');
        link.href = indicator.dataset.siteVersionUrl;
        link.append(value);
        indicator.replaceChildren(link);
        if (matches) {
            const icon = document.createElement('span');
            icon.textContent = copy.content_current_icon;
            icon.title = copy.content_current;
            icon.setAttribute('aria-label', copy.content_current);
            icon.setAttribute('role', 'img');
            indicator.append(' ', icon);
        }
        indicator.dataset.siteContentState = matches ? 'current' : 'changed';
    } catch {
        indicator.textContent = copy.content_failed;
        indicator.dataset.siteContentState = 'failed';
    } finally {
        clearTimeout(timeout);
        refresh.disabled = false;
    }
}

if (indicator) {
    if (indicator.dataset.siteVersionUrl) {
        refresh.addEventListener('click', () => void checkContentVersion());
        const ready = () => {
            if (document.prerendering) document.addEventListener('prerenderingchange', () => void checkContentVersion(), { once: true });
            else void checkContentVersion();
        };
        if (document.readyState === 'complete') ready();
        else window.addEventListener('load', ready, { once: true });
    } else {
        indicator.dataset.siteContentState = 'unavailable';
    }
}
