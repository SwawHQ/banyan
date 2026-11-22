---
title: v0.2.0
url: p/v0.2.0/
description: Offline navigation, command help and upgrade instructions.
date: 2026-11-22
lastmod: 2026-11-22
---

When a page is unavailable offline, the service worker shows a built-in English notice. Sites upgrading to this version can remove their offline pages and `sw.offline_notice_path`. Remove any `site-status "offline"` shortcode before building.

The reference site hides the My page while its features are in development.

`swban` uses `command/help` for custom commands and points to it on argument errors. Native tools receive their own help arguments. Unknown commands show the list of common commands. Preview and build help now lists the default Hugo arguments and Pagefind settings.

The offline browser check now works when the selected page and its child paths use different cache rules.
