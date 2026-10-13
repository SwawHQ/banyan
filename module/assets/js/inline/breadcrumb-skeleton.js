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

function countVisibleItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return 0;
    }

    var total = 0;
    for (var index = 0; index < items.length; index += 1) {
        var item = items[index];
        if (!item || typeof item !== "object") {
            continue;
        }

        total += 1;
    }

    return total;
}

function countTrailItems(source) {
    var levels = Array.isArray(source && source.levels) ? source.levels : [];
    if (levels.length > 0) {
        return countVisibleItems(levels.map(function (level) {
            return level && typeof level.item === "object" ? level.item : null;
        }).filter(Boolean));
    }

    var tailItems = Array.isArray(source && source.tail_items)
        ? source.tail_items
        : [];

    return countVisibleItems(tailItems);
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

        var sourcePath = normalizePath(source.logical_path || "");
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

    var trailContainer = document.querySelector(".path-columns .slot-breadcrumb");
    if (!trailContainer) {
        return;
    }
    // Keep Hugo's default path for same-document source changes and history.
    trailContainer.defaultPath = trailContainer.firstElementChild?.cloneNode(true);
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
            placeholderCount = countTrailItems(entrySource);

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

    var nav = document.createElement("nav");
    nav.className = "path-navigation";
    nav.setAttribute("aria-hidden", "true");

    for (var itemIndex = 0; itemIndex < placeholderCount; itemIndex += 1) {
        var placeholder = document.createElement("div");
        placeholder.className = "path-column";
        placeholder.dataset.collectionColumn = "true";
        nav.appendChild(placeholder);
    }

    trailContainer.replaceChildren(nav);
} catch (_) { }
}

start();
