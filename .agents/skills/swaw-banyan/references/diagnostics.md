# Status and diagnostic pages

Read this when editing Powered by, Service Worker status or prefetch diagnostic
pages. These pages belong to the site. For cache policy, see
[Delivery configuration](delivery.md).

## Page layouts

Powered by uses `page-article-norss`. The base template loads the required script
once per page when it uses `site-status` or `page-actions`. Offline pages use
`page-offline`: Markdown, theme styles and the retry script, without navigation,
SW management or prefetch scripts.

## Status controls

Powered by keeps headings, prose, source and changelog links in each language's
Markdown. Use `new-tab` for those external links. `theme-version` outputs only the
theme version, with `local` text for a local build; `hugo-version` uses
`hugo.Version`; the reference pages place it inside the diagnostic disclosure.
Use separate `site-status` parts to arrange build information and update controls:

```text
Local: {{< site-status "version" >}}  
Server: {{< site-status "content" >}}  
Sync trigger: {{< site-status "interval" "On page navigation and interval ≥ %d minutes" >}}

SW policy: {{< site-status "policy" >}}  
SW status: {{< site-status "status" >}}
```

Keep fixed labels in Markdown and changing messages in `params.site_status.labels`.
Two trailing spaces make a line break. Shortcodes do not add code formatting.
The local row shows the site build version embedded in this page. The interval
comes from `sw.content_check_interval`. The server row reads the published site
build version from `sw-version.json` after page load and on refresh.
The version links to that JSON. A matching version adds
`content_current_icon`. Its refresh button
does not switch cache buckets. The status row checks the SW program. Each row has
its own refresh button; use `content_refresh` and `status_refresh` for their
accessible labels and `refresh_icon` for their shared symbol. `cache_disabled`
provides the disabled-cache message for the server, sync trigger and policy rows.
Unavailable rows remain visible, with disabled refresh buttons.
The policy link is static. Program status reports the configured mode and whether
an installed SW still controls the page. `off` leaves workers installed;
`disable` requests unregistering and managed-cache cleanup.

## Prefetch diagnostics

Append diagnostics in the same Markdown. `details-start` accepts inline Markdown
in `summary`, for example `summary="**More diagnostics**"`. `prefetch-debug-controls` outputs the
transport selector and status. Keep its text in `params.prefetch_debug.labels`,
as shown in the reference pages. `prefetch-debug-links` supplies a published
collection and article in the current language. `prefetch-debug-state` outputs
one live JSON panel: `support`, `env`, `actions`, `runtime` or `payload`.
Write panel headings and instructions in Markdown. Pages with the controls
shortcode load the diagnostic scripts; the backend choice affects that page.
Worker control state reports the same page's state. Review the reference pages
when upgrading, and keep your own page text.
