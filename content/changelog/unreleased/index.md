---
title: Unreleased
slug: unreleased
description: Unreleased changes to the Banyan theme and Skill.
lastmod: 2026-10-11
---

## Added

- Hugo Module at `github.com/SwawHQ/banyan/module`, with matching
  `swaw-banyan` Skill versions. `check/module` checks release versions,
  vendored dependencies and local development.
- Windows x64 CLI with Bun or Node, Git, Go, Hugo and optional GitHub CLI.
  Portable downloads are checksum-verified; sites need no npm dependencies.
- Name and product list views with shared column navigation and sorting.
  Site-owned taxonomies define product classifications.
- Powered by page with the effective theme and Hugo versions, site build
  details, and PWA status and update checks.
- Versioned release notes in the demo site's `content/changelog/`.
  `params.theme_changelog` sets the Powered by release-notes URL.
- Browser checks for navigation, layout, language settings, images, prefetch
  and PWA, with Chromium and selected WebKit checks. `check/browser/site`
  discovers representative pages and reports skipped coverage.
- Static and HTTP checks for content, HTML, sitemap, robots, LLMS, images,
  CSP, SRI, cache headers and prefetch, plus asset-size and payload reports.
  HTML checks also validate article date rows, path order, aside controllers
  and static update controls.
- `sync/ext` for declared external resources and `deploy/edgeone/sync`
  for generated deployment configuration.
- MIT licenses for the repository, Module and Skill, with third-party notices.

## Changed

- Sitemaps include rendered, indexable HTML pages regardless of `build.list`.
  Use native `sitemap.disable` in content front matter to exclude a page;
  remove `params.sitemap.include_pages`. Noindex pages and excluded translations
  stay outside sitemap entries and alternate-language links.
- Distribute the theme from `module/`; keep the demo at the repository root
  and site-specific content and configuration outside the Module.
- Use native Hugo for builds and previews, and native Git and GitHub CLI
  for releases.
- Build and minify JavaScript with Hugo, and generate CSP and deployment
  headers during the build. Sites must set `minify.disableJS = true`
  to preserve inline script hashes.
- PWA checks do not activate updates or reload pages. A ready update activates
  before the next ordinary same-tab site link. Refresh, history and other tabs
  keep native behavior.
- List dates and date sorting use `lastmod`, then `date`. Git commits and
  filesystem times do not change editorial dates.

## Fixed

- Chapter navigation uses the current URL fragment when scrolling runs,
  so a pending chapter scroll cannot override a newer skip-to-content action.
