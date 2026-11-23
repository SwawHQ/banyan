---
title: Unreleased
url: p/unreleased/
description: Changes for the next Banyan release.
date: 2026-11-22
lastmod: 2026-11-23
---

- The Module supplies the article archetype, SVG icon library, three palettes, web app manifest template and robots.txt template. Sites can override each file at the same path.
- The Powered by page keeps the Banyan logo when the site changes its favicon.
- Sites can disable the web app manifest with `params.manifest.enabled = false` in `hugo.toml`. Use `apple-touch-icon.png` for the Apple touch icon and `pwa-192.png`, `pwa-256.png`, and `pwa-512.png` for the default manifest.
- Replace `assets/site/avatar.github.svg` to update the GitHub avatar in all languages.
- Interface dictionaries now use the site-root `i18n/` directory and one `key = "text"` entry per line.
- Deployment switches now use `assets/deploy/settings.toml` and site redirects use `assets/deploy/redirects.toml`. The Module supplies the default cache and prefetch policy.
- Declare downloads in `assets/site/external-resources.toml`. Preview and build fetch missing files. Run `swban sync/resources` to refresh them.
