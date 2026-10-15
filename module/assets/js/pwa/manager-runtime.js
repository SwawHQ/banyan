export function createServiceWorkerManagerRuntime(options = {}) {
    const swUrl = typeof options.swUrl === 'string' && options.swUrl ? options.swUrl : '/sw.js';
    const swScope = typeof options.swScope === 'string' && options.swScope ? options.swScope : '/';
    const existingRuntime = window.BanyanServiceWorkerManagerRuntime;
    if (
        existingRuntime
        && existingRuntime.swUrl === swUrl
        && existingRuntime.swScope === swScope
    ) {
        return existingRuntime;
    }

    let currentRegistration = null;

    function supportsServiceWorker() {
        return 'serviceWorker' in navigator;
    }

    function getActiveRegistration() {
        return currentRegistration;
    }

    function setActiveRegistration(registration) {
        currentRegistration = registration || null;
        return currentRegistration;
    }

    async function getActiveWorkerRegistration() {
        if (currentRegistration?.active) return currentRegistration;

        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration?.active) {
                currentRegistration = registration;
                return registration;
            }
        } catch (error) { }

        return null;
    }

    const runtime = {
        getActiveRegistration,
        getActiveWorkerRegistration,
        setActiveRegistration,
        supportsServiceWorker,
        swScope,
        swUrl
    };

    window.BanyanServiceWorkerManagerRuntime = runtime;
    return runtime;
}
