import { readFragment } from '../browse/navigation-state.contract.js';

function parseJson(value, fallback) {
    if (typeof value !== "string" || value === "") {
        return fallback;
    }

    try {
        var parsed = JSON.parse(value);
        return parsed == null ? fallback : parsed;
    } catch (_) {
        return fallback;
    }
}

function normalizePath(value) {
    if (typeof value !== "string") {
        return "";
    }

    var decoded;
    try {
        decoded = decodeURIComponent(value.trim());
    } catch (_) {
        decoded = value.trim();
    }

    var segments = decoded.split("/").filter(Boolean);
    return segments.length === 0 ? "" : "/" + segments.join("/") + "/";
}

function countPathColumns(source) {
    var columns = Array.isArray(source && source.columns) ? source.columns : [];
    return columns.filter(function (column) {
        return column && column.selected && typeof column.selected === "object";
    }).length;
}

function findSource(sources, logicalPath) {
    var normalizedPath = normalizePath(logicalPath);
    if (!normalizedPath) {
        return null;
    }

    for (var index = 0; index < sources.length; index += 1) {
        var source = sources[index];
        if (!source || typeof source !== "object") {
            continue;
        }

        var sourcePath = normalizePath(source.logicalPath || "");
        if (sourcePath === normalizedPath) {
            return source;
        }
    }

    return null;
}

function start() {
try {
    var html = document.documentElement;
    var entryPending = html.getAttribute("data-entry-breadcrumb-pending") === "true";
    var body = document.body;
    if (!body) {
        return;
    }

    var nav = document.querySelector('[data-slot="breadcrumb"]');
    if (!nav) {
        return;
    }
    // Keep Hugo's default path for same-document source changes and history.
    nav.defaultPath = nav.cloneNode(true);
    if (!entryPending) return;

    var entryBreadcrumbSources = parseJson(body.dataset.entryBreadcrumbSources || "", []);
    if (!Array.isArray(entryBreadcrumbSources) || entryBreadcrumbSources.length === 0) {
        return;
    }

    var params = readFragment(window.location.hash);
    var placeholderCount = 0;

    if (entryPending) {
        var entrySource = findSource(entryBreadcrumbSources, params.get('from') || "");
        if (entrySource) {
            placeholderCount = countPathColumns(entrySource);

            var currentPageText = body.dataset.currentPageText || document.title || "";
            var currentPageHref = window.location.pathname + window.location.search + window.location.hash;
            if (currentPageText && currentPageHref) {
                placeholderCount += 1;
            }
        }
    }

    if (placeholderCount <= 0) {
        return;
    }

    var columns = document.createDocumentFragment();
    nav.setAttribute("aria-hidden", "true");

    for (var itemIndex = 0; itemIndex < placeholderCount; itemIndex += 1) {
        var placeholder = document.createElement("div");
        placeholder.className = "page-column path-column";
        placeholder.dataset.collectionColumn = "true";
        columns.appendChild(placeholder);
    }

    nav.replaceChildren(columns);
} catch (_) { }
}

start();
