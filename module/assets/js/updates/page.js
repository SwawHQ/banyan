const panel = document.querySelector('[data-site-update-panel]');

function readCopy() {
    try {
        const copy = JSON.parse(panel?.dataset.siteUpdateCopy || '');
        return copy && typeof copy === 'object' ? copy : null;
    } catch (error) {
        return null;
    }
}

function getStatusValue(copy, status, latencyMs) {
    if (status === 'unavailable') return copy.unavailable;
    if (status === 'checking') return copy.checking;
    if (status === 'installing') return copy.installing;
    if (status === 'failed') return `${copy.check_failed} · ${copy.status_click_retry}`;
    if (status === 'offline') return `${copy.status_offline} · ${copy.status_click_retry}`;
    if (status === 'ready') return copy.status_ready;

    const latency = Number.isFinite(latencyMs) && latencyMs >= 0
        ? ` · ${Math.round(latencyMs)}ms`
        : '';
    return `${copy.status_current}${latency}`;
}

function render(copy, status, latencyMs) {
    panel.dataset.siteUpdateState = status;
    const action = panel.querySelector('[data-site-update-action]');
    const label = action?.querySelector('[data-site-update-action-label]');
    if (action) action.disabled = ['checking', 'installing', 'unavailable'].includes(status);
    if (label) label.textContent = status === 'checking' ? copy.checking : copy.check;

    const statusNode = panel.querySelector('[data-site-update-status]');
    const value = getStatusValue(copy, status, latencyMs);
    if (statusNode) statusNode.textContent = value ? `${copy.status}: ${value}` : '';
}

const copy = panel ? readCopy() : null;
const action = panel?.querySelector('[data-site-update-action="check"]');
let registration = null;
let checking = false;
let latencyMs = null;

function showStatus(status) {
    render(copy, status, latencyMs);
}

function syncRegistrationStatus() {
    if (registration) showStatus(registration.waiting ? 'ready' : registration.installing ? 'installing' : 'current');
}

function watchInstallingWorker() {
    const installing = registration.installing;
    if (!installing) return;
    latencyMs = null;
    showStatus('installing');
    const onStateChange = () => {
        if (!['installed', 'redundant'].includes(installing.state)) return;
        installing.removeEventListener('statechange', onStateChange);
        if (installing.state === 'installed' || registration.waiting) syncRegistrationStatus();
        else showStatus('failed');
    };
    installing.addEventListener('statechange', onStateChange);
    onStateChange();
}

async function readRegistration() {
    const found = await navigator.serviceWorker.getRegistration('/')
        || await navigator.serviceWorker.register(panel.dataset.siteSwUrl, {
            scope: '/',
            updateViaCache: 'none'
        });
    if (found !== registration) {
        registration = found;
        registration.addEventListener('updatefound', watchInstallingWorker);
        watchInstallingWorker();
    }
    return registration;
}

async function checkForUpdates() {
    if (checking) return;
    latencyMs = null;
    if (navigator.onLine === false) {
        showStatus('offline');
        return;
    }
    checking = true;
    showStatus('checking');
    const startedAt = performance.now();
    try {
        const current = await readRegistration();
        await current.update();
        latencyMs = Math.max(0, performance.now() - startedAt);
        syncRegistrationStatus();
    } catch {
        showStatus(navigator.onLine === false ? 'offline' : 'failed');
    } finally {
        checking = false;
    }
}

async function start() {
    try {
        await readRegistration();
        syncRegistrationStatus();
    } catch {
        showStatus(navigator.onLine === false ? 'offline' : 'failed');
    }
}

if (panel && copy) {
    if (action && 'serviceWorker' in navigator) {
        action.addEventListener('click', (event) => {
            event.preventDefault();
            void checkForUpdates();
        });
        navigator.serviceWorker.addEventListener('controllerchange', syncRegistrationStatus);
        showStatus('checking');
        const ready = () => {
            if (document.prerendering) document.addEventListener('prerenderingchange', () => void start(), { once: true });
            else void start();
        };
        if (document.readyState === 'complete') ready();
        else window.addEventListener('load', ready, { once: true });
    } else {
        showStatus('unavailable');
    }
}
