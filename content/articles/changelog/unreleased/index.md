---
title: Unreleased
url: p/unreleased/
description: Changes for the next Banyan release.
date: 2026-11-22
lastmod: 2026-11-24
---

- The Module supplies an archetype for each page layout, SVG icon library, three palettes, web app manifest template and robots.txt template. Sites can override each file at the same path.
- Create articles with `--kind page-article-rss`. Set each Powered by translation to `page-powered-by`. Remove calls to `site-status`, `prefetch-debug-controls`, `prefetch-debug-links` and `prefetch-debug-state`, and translate `params.diagnostics` from the page archetype.
- The Powered by page keeps the Banyan logo when the site changes its favicon.
- Sites can disable the web app manifest with `params.manifest.enabled = false` in `hugo.toml`. Use `apple-touch-icon.png` for the Apple touch icon and `pwa-192.png`, `pwa-256.png`, and `pwa-512.png` for the default manifest.
- Replace `assets/site/avatar.github.svg` to update the GitHub avatar in all languages.
- Interface dictionaries now use the site-root `i18n/` directory and one `key = "text"` entry per line.
- Deployment switches and the SW content check interval now use `assets/deploy/settings.toml`. Site redirects use `assets/deploy/redirects.toml`. Use `module/archetypes/assets/deploy/settings.toml` to check settings during upgrades. The Module supplies the default cache and prefetch policy.
- Declare downloads in `assets/deploy/external-resources.toml`. Run `swban sync/resources` to download them. Add `--force` to replace existing files.
- Replace `centered-image` with Markdown such as `![View](photo.jpg)`. The image follows the article’s standard alignment and sizing.
- Replace each `home-art` bundle call with `art-wind` and move the translated wind settings into its JSON body. Use ordinary Markdown for a text-only home.
- Each language root opens with only navigation and no selection. The Home entry opens the wind scene in `content/home/index*.md`.
- Activate a selected navigation entry to return to its list. Opening its link in a new tab still opens the entry.
