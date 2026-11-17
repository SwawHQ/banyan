import { requestBreadcrumbText } from '../browse/breadcrumb-request.js';
import { readNavigation, readActiveNavigationRoute } from '../browse/navigation-source.js';

if (document.documentElement.dataset.hasBreadcrumbColumns === 'true') {
    document.documentElement.setAttribute('data-breadcrumb-pending', 'true');
    // A stalled controller must not hold the first paint indefinitely.
    const timer = setTimeout(() => document.querySelector('script[data-breadcrumb-runtime]')?.removeAttribute('blocking'), 8000);
    window.addEventListener('load', () => clearTimeout(timer), { once: true });
    const navigation = readNavigation();
    for (const { column } of readActiveNavigationRoute().columns) {
        try {
            // Keep the result, including a failure, for the controller to consume once.
            const hash = navigation.columns[column].hash;
            requestBreadcrumbText(new URL(`${navigation.resources}${hash}.js`, window.location.href), true).catch(() => {});
        } catch (_) { }
    }
}
