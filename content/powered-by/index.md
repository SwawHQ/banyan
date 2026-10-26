---
title: Powered by
description: "The technology behind this site, build information, PWA and prefetch status."
url: powered-by/ #Keep this route when renaming the content directory.
layout: page-article-norss #Render Markdown; shortcodes enable interactive controls.
weight: 96

params:
  icon: code
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  site_update: #Text for the site-update shortcode below.
    labels: #Translate values for this language; keep the keys.
      check: "Check for updates"
      checking: "Checking…"
      installing: "Installing the new version…"
      check_failed: "Check failed"
      unavailable: "Service Worker updates are unavailable in this environment."
      status: "Update status"
      status_current: "No update waiting to activate"
      status_ready: "New program ready; the browser will activate it after pages using the old program are closed."
      status_offline: "Offline"
      status_click_retry: "try checking again"
  prefetch_debug:
    labels:
      backend: "Prefetch transport"
      auto: "Auto"
      native: "Native"
      sw: "SW"
      link: "Link"
      off: "Off"
      apply: "Apply and reload"
      loading: "Loading…"
      unavailable: "Unavailable"
      collection: "Collection"
      article: "Article"
---

## Banyan {#banyan}

The Hugo theme behind this site, with column browsing, multilingual pages and offline access.

{{< theme-version label="Theme version" local="Local development" >}}

{{< new-tab href="https://github.com/SwawHQ/banyan" >}}Source{{< /new-tab >}} · {{< new-tab href="https://swaw.com/d/banyan/changelog/" >}}Change log{{< /new-tab >}}

## Hugo {#hugo}

The static site generator used to build this site.

Version: {{< hugo-version >}}

{{< new-tab href="https://gohugo.io/" >}}Website{{< /new-tab >}} · {{< new-tab href="https://gohugo.io/news/" >}}Releases{{< /new-tab >}}

## Site build {#build}

{{< site-build >}}

## PWA {#pwa}

Offline access. The browser manages Service Worker program updates.

{{< site-update >}}

## Prefetch diagnostics {#diagnostics}

{{< details-start summary="View diagnostics" >}}

This test applies to this page. Choose a transport, then apply and reload.

{{< prefetch-debug-controls >}}

This choice does not bypass Service Worker interception or remove its registration.

To bypass Service Worker interception, use DevTools → Application → Service Workers → Bypass for network. Inspect native prefetch in Application → Speculative loads.

### Test links

Hover or focus a link. On a touch screen, tap it. The browser schedules prefetch according to the current policy.

{{< prefetch-debug-links >}}

### Browser support

{{< prefetch-debug-state "support" >}}

### Selected backend

{{< prefetch-debug-state "env" >}}

### Potential candidates

{{< prefetch-debug-state "actions" >}}

### Custom dispatch

{{< prefetch-debug-state "runtime" >}}

### Published configuration and rules

{{< prefetch-debug-state "payload" >}}

{{< details-end >}}
