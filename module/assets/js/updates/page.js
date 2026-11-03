import './content.js';

const panel = document.querySelector('[data-site-update-panel]');

function readCopy() {
    try {
        const copy = JSON.parse(panel?.dataset.siteUpdateCopy || '');
        return copy && typeof copy === 'object' ? copy : null;
    } catch (error) {
        return null;
    }
}

function getStatusValue(copy, status) {
    if (status === 'unavailable') return copy.unavailable;
    if (status === 'checking') return copy.checking;
    if (status === 'installing') return copy.installing;
    if (status === 'failed') return `${copy.check_failed} · ${copy.status_click_retry}`;
    if (status === 'offline') return `${copy.status_offline} · ${copy.status_click_retry}`;
    if (status === 'ready') return copy.status_ready;

    return copy.status_current;
}

function render(copy, status) {
    panel.dataset.siteUpdateState = status;
    if (action) action.disabled = checking || ['checking', 'installing', 'unavailable'].includes(status);

    const value = getStatusValue(copy, status);
    panel.textContent = value || '';
}

const copy = panel ? readCopy() : null;
const action = document.querySelector('[data-site-update-action="check"]');
let registration = null;
let checking = false;

function showStatus(status) {
    render(copy, status);
}

function syncRegistrationStatus() {
    if (checking) return;
    if (registration) showStatus(registration.waiting ? 'ready' : registration.installing ? 'installing' : 'current');
}

function watchInstallingWorker() {
    const installing = registration.installing;
    if (!installing) return;
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
    if (navigator.onLine === false) {
        showStatus('offline');
        return;
    }
    checking = true;
    showStatus('checking');
    let failed = false;
    try {
        const current = await readRegistration();
        await current.update();
    } catch {
        failed = true;
    }
    checking = false;
    if (failed) {
        showStatus(navigator.onLine === false ? 'offline' : 'failed');
    } else {
        syncRegistrationStatus();
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
    if (panel.dataset.siteSwMode !== 'enable') {
        const showMode = () => {
            panel.dataset.siteUpdateState = panel.dataset.siteSwMode;
            panel.textContent = copy['mode_' + panel.dataset.siteSwMode]
                + (navigator.serviceWorker?.controller ? ' ' + copy.status_controlled : '');
        };
        navigator.serviceWorker?.addEventListener('controllerchange', showMode);
        showMode();
    } else if ('serviceWorker' in navigator) {
        action?.addEventListener('click', (event) => {
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
