---
title: Powered by
description: "The technology behind this site, build information, PWA and prefetch status."
url: powered-by/ #Keep this route when renaming the content directory.
layout: page-powered-by
weight: 100

params:
  icon: code
  slots: [breadcrumb] #breadcrumb: breadcrumb navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  site_status:
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
  diagnostics:
    heading: "Appendix: PWA cache information"
    version: "Local:"
    content: "Server:"
    interval: "Sync trigger:"
    policy: "SW policy:"
    status: "SW status:"
    interval_format: "On page navigation and interval ≥ %d minutes"
    hugo: "Hugo:"
    more: "More diagnostics"
    transport_intro: "This test applies to this page. Choose a transport, then apply and reload."
    worker_note: "This choice does not bypass Service Worker interception or remove its registration."
    devtools_note: "To bypass Service Worker interception, use DevTools → Application → Service Workers → Bypass for network. Inspect native prefetch in Application → Speculative loads."
    test_links: "Test links"
    link_hint: "Hover or focus a link. On a touch screen, tap it. The browser schedules prefetch according to the current policy."
    support: "Browser support"
    env: "Selected backend"
    actions: "Potential candidates"
    runtime: "Custom dispatch"
    payload: "Published configuration and rules"
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

**Swaw Banyan** {{< asset src="site/swaw-banyan.svg" alt="Banyan" class="icon icon--image md-inline-image" width="16" height="16" >}}: {{< new-tab href="https://github.com/SwawHQ/banyan" >}}{{< theme-version local="Local development" >}}{{< /new-tab >}}
