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
    if (status === 'idle') return '';
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

function render(copy, status, latencyMs, controlled) {
    panel.dataset.siteUpdateState = status;
    const action = panel.querySelector('[data-site-update-action]');
    const label = action?.querySelector('[data-site-update-action-label]');
    if (action) action.disabled = ['checking', 'installing', 'unavailable'].includes(status);
    if (label) label.textContent = status === 'checking' ? copy.checking : copy.check;

    panel.querySelector('[data-pwa-controlled]').textContent = controlled ? copy.yes : copy.no;
    const statusNode = panel.querySelector('[data-site-update-status]');
    const value = getStatusValue(copy, status, latencyMs);
    if (statusNode) statusNode.textContent = value ? `${copy.status}: ${value}` : '';
}

const copy = panel ? readCopy() : null;
const updates = window.BanyanServiceWorkerManagerRuntime?.updates;
if (panel && copy) {
    if (updates) {
        updates.subscribe(({ status, latencyMs, controlled }) => render(copy, status, latencyMs, controlled));
        panel.querySelector('[data-site-update-action="check"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            void updates.check();
        });
    } else {
        render(copy, 'unavailable', null, Boolean(navigator.serviceWorker?.controller));
    }
}
