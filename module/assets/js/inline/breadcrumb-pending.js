import { requestBreadcrumbText } from '../browse/breadcrumb-request.js';

if (document.documentElement.dataset.hasBreadcrumbColumns === 'true') {
    document.documentElement.setAttribute('data-entry-breadcrumb-pending', 'true');
    for (const hint of document.head.querySelectorAll('meta[name="banyan-navigation-fragment"]')) {
        try {
            // Keep the result, including a failure, for the controller to consume once.
            requestBreadcrumbText(new URL(hint.content, window.location.href)).catch(() => {});
        } catch (_) { }
    }
}
