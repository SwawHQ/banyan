---
title: Powered by
description: "The technology behind this site, build information, PWA and prefetch status."
url: powered-by/ #Keep this route when renaming the content directory.
layout: page-article-norss #Render Markdown; shortcodes enable interactive controls.
weight: 100

params:
  icon: code
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  site_update: #Text for the site-update shortcode below.
    labels: #Translate values for this language; keep the keys.
      checking: "Checking…"
      installing: "Installing the new version…"
      check_failed: "Check failed"
      unavailable: "Service Worker updates are unavailable in this environment."
      status_current: "No update waiting to activate"
      status_ready: "New program ready; the browser will activate it after pages using the old program are closed."
      status_offline: "Offline"
      status_click_retry: "try checking again"
      content_current: "Page version matches the published version"
      content_failed: "Version check failed; try again"
      mode_off: "Service Worker management is off for this site."
      mode_disable: "This site requests Service Worker removal and cache cleanup."
      status_controlled: "An installed Service Worker still controls this page."
      cache_disabled: "Caching is disabled"
      content_checking: "Checking version…"
      content_current_icon: "✅"
      refresh_icon: "↻"
      content_refresh: "Refresh server version"
      status_refresh: "Check for SW program updates"
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

**Swaw Banyan** {{< asset src="site/favicon.link.svg" alt="Banyan" class="icon icon--image md-inline-image" width="16" height="16" >}}: {{< new-tab href="https://github.com/SwawHQ/banyan" >}}{{< theme-version local="Local development" >}}{{< /new-tab >}}

### Appendix: PWA cache information

**Local**: {{< site-update "version" >}}  
**Server**: {{< site-update "content" >}}  
**Sync trigger**: {{< site-update "interval" "On page navigation and interval ≥ %d minutes" >}}  
**SW policy**: {{< site-update "policy" >}}  
**Offline notice page**: {{< site-update "offline" >}}\
**SW status**: {{< site-update "status" >}}

{{< details-start summary="**More diagnostics**" >}}

Hugo: {{< new-tab href="https://gohugo.io/news/" >}}{{< hugo-version >}}{{< /new-tab >}}

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
