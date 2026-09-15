const SW_ACTIVATION_TIMEOUT_MS = 4000;

let updateCheckTimer = null;
let warmedCurrentUrl = '';
let updateController = null;
const statusListeners = new Set();
let updateStatus = 'idle';
let updateLatencyMs = null;
let updateCheckPromise = null;
let activationPromise = null;

function publishUpdateStatus() {
    for (const listener of statusListeners) listener({ status: updateStatus, latencyMs: updateLatencyMs });
}

function setUpdateReadyState(ready) {
    if (ready) {
        updateStatus = 'ready';
    } else if (updateStatus === 'ready') {
        updateStatus = 'idle';
    }
    publishUpdateStatus();
}

async function checkForUpdates(runtime) {
    if (updateStatus === 'unavailable') return;
    if (updateStatus === 'ready') {
        if (await activateWaitingWorker(runtime)) window.location.reload();
        return;
    }

    if (activationPromise) return activationPromise;
    if (updateCheckPromise) return updateCheckPromise;

    if (navigator.onLine === false) {
        updateLatencyMs = null;
        updateStatus = 'offline';
        publishUpdateStatus();
        return;
    }

    const checkStartedAt = performance.now();
    updateLatencyMs = null;
    updateStatus = 'checking';
    updateCheckPromise = (async () => {
        try {
            publishUpdateStatus();
            const registration = runtime.getActiveRegistration() || await navigator.serviceWorker.getRegistration(runtime.swScope);
            if (!registration) {
                updateLatencyMs = null;
                updateStatus = 'failed';
                publishUpdateStatus();
                return;
            }

            await registration.update();
            updateLatencyMs = Math.max(0, performance.now() - checkStartedAt);
            if (bindWaitingWorker(runtime, registration)) {
                updateStatus = 'ready';
                publishUpdateStatus();
                return;
            }

            updateStatus = 'current';
            publishUpdateStatus();
        } catch (error) {
            updateLatencyMs = null;
            updateStatus = navigator.onLine === false ? 'offline' : 'failed';
            publishUpdateStatus();
        } finally {
            updateCheckPromise = null;
        }
    })();

    return updateCheckPromise;
}

async function warmCurrentPage(runtime) {
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = '';
    const href = currentUrl.toString();
    if (warmedCurrentUrl === href) return;

    warmedCurrentUrl = href;
    try {
        const registration = runtime ? await runtime.getActiveWorkerRegistration() : null;
        const worker = registration?.active || null;
        if (!worker) return;

        worker.postMessage({
            type: 'WARM_NAV_BATCH',
            urls: [href]
        });
    } catch (error) { }
}

function bindWaitingWorker(runtime, registration) {
    if (!registration?.waiting) return false;

    runtime.setActiveRegistration(registration);
    setUpdateReadyState(true);
    void warmCurrentPage(runtime);
    return true;
}

function watchInstallingWorker(runtime, registration) {
    const installing = registration.installing;
    if (!installing) return;

    installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            bindWaitingWorker(runtime, registration);
        }
    });
}

function markBackgroundUpdateChecked(runtime, registration) {
    if (bindWaitingWorker(runtime, registration)) return;
    updateLatencyMs = null;
    if (updateStatus !== 'ready') updateStatus = 'current';
    publishUpdateStatus();
}

function scheduleRegistrationUpdates(runtime, registration) {
    if (updateCheckTimer) return;

    const intervalMs = runtime.updateCheckInterval || 15 * 60 * 1000;
    const throttleMs = runtime.updateVisibilityThrottle || 3 * 60 * 1000;

    updateCheckTimer = window.setInterval(() => {
        registration.update()
            .then(() => markBackgroundUpdateChecked(runtime, registration))
            .catch(() => { });
    }, intervalMs);

    let lastUpdateCheck = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;

        const now = Date.now();
        if (now - lastUpdateCheck <= throttleMs) return;

        lastUpdateCheck = now;
        registration.update()
            .then(() => markBackgroundUpdateChecked(runtime, registration))
            .catch(() => { });
    });
}

function activateWaitingWorker(runtime) {
    if (activationPromise) return activationPromise;
    const worker = runtime.getActiveRegistration()?.waiting;
    if (!worker) return Promise.resolve(false);

    updateStatus = 'checking';
    publishUpdateStatus();
    activationPromise = new Promise(resolve => {
        const finish = success => {
            window.clearTimeout(timer);
            worker.removeEventListener('statechange', onChange);
            navigator.serviceWorker.removeEventListener('controllerchange', onChange);
            window.removeEventListener('pagehide', onLeave);
            updateStatus = success ? 'current' : 'failed';
            publishUpdateStatus();
            resolve(success);
        };
        const onChange = () => {
            if (worker.state === 'activated' && navigator.serviceWorker.controller === worker) finish(true);
            else if (worker.state === 'redundant') finish(false);
        };
        const onLeave = () => finish(false);
        const timer = window.setTimeout(() => finish(false), SW_ACTIVATION_TIMEOUT_MS);
        worker.addEventListener('statechange', onChange);
        navigator.serviceWorker.addEventListener('controllerchange', onChange);
        window.addEventListener('pagehide', onLeave, { once: true });
        try {
            worker.postMessage({ type: 'SKIP_WAITING' });
        } catch {
            finish(false);
        }
    }).finally(() => { activationPromise = null; });
    return activationPromise;
}

async function handleEnableMode(runtime) {
    try {
        // updateViaCache=none 让浏览器检查 /sw.js 时绕过 HTTP 缓存，尽快发现新 worker。
        const registration = await navigator.serviceWorker.register(runtime.swUrl, {
            scope: runtime.swScope,
            updateViaCache: 'none'
        });
        runtime.setActiveRegistration(registration);

        bindWaitingWorker(runtime, registration);

        watchInstallingWorker(runtime, registration);
        registration.addEventListener('updatefound', () => {
            watchInstallingWorker(runtime, registration);
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            setUpdateReadyState(false);
        });

        scheduleRegistrationUpdates(runtime, registration);
        void warmCurrentPage(runtime);
        navigator.serviceWorker.ready.then((readyRegistration) => {
            if (readyRegistration?.active) runtime.setActiveRegistration(readyRegistration);
        }).catch(() => { });
    } catch (error) { }
}

// The engine owns SW state; the update page subscribes without loading its UI globally.
export function startEnableMode(runtime) {
    if (updateController) return updateController;
    updateController = {
        subscribe(listener) {
            statusListeners.add(listener);
            listener({ status: updateStatus, latencyMs: updateLatencyMs });
            return () => statusListeners.delete(listener);
        },
        check: () => checkForUpdates(runtime),
        activate: () => activateWaitingWorker(runtime)
    };
    if (!runtime?.supportsServiceWorker()) {
        updateStatus = 'unavailable';
        return updateController;
    }
    if (document.readyState === 'complete') void handleEnableMode(runtime);
    else window.addEventListener('load', () => void handleEnableMode(runtime), { once: true });
    return updateController;
}
