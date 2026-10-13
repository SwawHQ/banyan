import { readFragment } from '../browse/navigation-state.contract.js';

function start() {
try {
    var html = document.documentElement;
    var params = readFragment(window.location.hash);
    var from = params.get('from') || '';
    var sort = (params.get('sort') || '').trim();
    var sorts = (params.get('sorts') || '').trim();
    var segments = typeof from === "string" ? from.trim().split("/").filter(Boolean) : [];
    var canSortCollectionBreadcrumb = html.dataset.canSortCollectionBreadcrumb === "true";

    if (segments.length > 0) {
        html.setAttribute("data-entry-breadcrumb-pending", "true");
        return;
    }

    if (canSortCollectionBreadcrumb && (sort !== "" || sorts !== "")) {
        html.setAttribute("data-breadcrumb-sort-pending", "true");
    }
} catch (_) { }
}

start();
