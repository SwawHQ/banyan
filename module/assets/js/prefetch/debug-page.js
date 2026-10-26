import { buildRuntimeActions } from './policy.js';
import {
    readPrefetchAnchorCandidates,
    readPrefetchPayload,
    readPrefetchRules,
    readPrefetchState,
    readRequestedPrefetchBackend,
    supportsLinkPrefetch,
    supportsServiceWorkerApi,
    supportsSpeculationRules
} from './browser.js';

(function () {
    if (!document.body.hasAttribute('data-prefetch-debug')) return;

    const form = document.getElementById('prefetch-debug-controls');
    const select = document.getElementById('prefetch-debug-backend');
    const status = document.getElementById('prefetch-debug-status');
    const copy = JSON.parse(form.dataset.prefetchDebugCopy);
    const requested = readRequestedPrefetchBackend();
    const nativeScript = document.getElementById('site-speculation-rules');
    const publishedNativeRules = nativeScript ? JSON.parse(nativeScript.textContent) : null;
    let workerSnapshot = { status: 'pending', registration: null };
    let workerReadPending = false;

    select.value = requested;
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        const url = new URL(window.location.href);
        if (select.value === 'auto') url.searchParams.delete('prefetch-backend');
        else url.searchParams.set('prefetch-backend', select.value);
        window.history.replaceState(window.history.state, '', url);
        window.location.reload();
    });

    function writePre(id, value) {
        const node = document.getElementById(id);
        if (node) node.textContent = JSON.stringify(value, null, 2);
    }

    function describeWorker(worker) {
        return worker ? { scriptURL: worker.scriptURL, state: worker.state } : null;
    }

    function refresh() {
        const config = readPrefetchPayload() || {};
        const selectors = { prefetch: readPrefetchRules(), prerender: readPrefetchRules('prerender') };
        const candidates = readPrefetchAnchorCandidates(selectors.prefetch);
        const prerenderCandidates = readPrefetchAnchorCandidates(selectors.prerender);
        const state = readPrefetchState() || {
            requested, backend: 'off', reason: 'selecting', dispatched: 0, failures: 0
        };
        const container = supportsServiceWorkerApi() ? navigator.serviceWorker : null;

        status.textContent = state.reason === 'selecting' ? copy.loading
            : state.reason.endsWith('-unavailable') || state.reason === 'no-backend'
                ? `${copy[state.requested]}: ${copy.unavailable}`
                : `${copy[state.requested]} → ${copy[state.backend]}`;
        writePre('prefetch-debug-support', {
            speculationRules: supportsSpeculationRules(),
            linkPrefetch: supportsLinkPrefetch(),
            serviceWorkerApi: supportsServiceWorkerApi(),
            secureContext: window.isSecureContext,
            serviceWorker: {
                controlled: Boolean(container?.controller),
                controller: describeWorker(container?.controller),
                ...workerSnapshot
            }
        });
        writePre('prefetch-debug-env', {
            requested: state.requested, backend: state.backend, reason: state.reason
        });
        writePre('prefetch-debug-actions', {
            prefetch: buildRuntimeActions(config.modes || {}, candidates, window.location.href),
            prerender: buildRuntimeActions(config.prerender || {}, prerenderCandidates, window.location.href)
        });
        writePre('prefetch-debug-runtime', {
            dispatched: state.dispatched,
            failures: state.failures,
            prefetchReady: document.documentElement.hasAttribute('data-prefetch-ready'),
            nativeReady: document.documentElement.hasAttribute('data-prefetch-native-ready'),
            prefetchLinkCount: document.head.querySelectorAll('link[rel="prefetch"][data-prefetch-link="runtime"]').length,
            nativeRulesPresent: Boolean(document.getElementById('site-speculation-rules'))
        });
        writePre('prefetch-debug-payload', { config, selectors, publishedNativeRules });
    }

    async function inspectWorker() {
        if (workerReadPending) return;
        if (!supportsServiceWorkerApi()) {
            workerSnapshot = { status: 'unavailable', registration: null };
            refresh();
            return;
        }
        workerReadPending = true;
        let timer;
        try {
            const scope = readPrefetchPayload()?.sw?.scope || window.location.href;
            const registration = await Promise.race([
                navigator.serviceWorker.getRegistration(scope),
                new Promise(resolve => { timer = window.setTimeout(() => resolve('timeout'), 250); })
            ]);
            workerSnapshot = {
                status: registration === 'timeout' ? 'timeout' : registration ? 'available' : 'none',
                registration: registration && registration !== 'timeout' ? {
                    scope: registration.scope,
                    installing: describeWorker(registration.installing),
                    waiting: describeWorker(registration.waiting),
                    active: describeWorker(registration.active)
                } : null
            };
        } catch (error) {
            workerSnapshot = { status: 'error', registration: null };
        } finally {
            window.clearTimeout(timer);
            workerReadPending = false;
            refresh();
        }
    }

    window.addEventListener('banyan:prefetch-state', refresh);
    if (supportsServiceWorkerApi()) navigator.serviceWorker.addEventListener('controllerchange', inspectWorker);
    document.addEventListener('DOMContentLoaded', function () {
        // The later runtime listener opens the shared readiness gate first.
        window.setTimeout(function () { refresh(); void inspectWorker(); }, 0);
    });
}());
