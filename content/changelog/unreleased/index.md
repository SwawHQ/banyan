---
title: Unreleased
slug: unreleased
description: Unreleased changes to the Banyan theme and Skill.
lastmod: 2026-10-13
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

- Move the frontend `from`, `sort`, and `sorts` fields into URL fragments,
  preserving them in chapter links. Back and Forward restore the source and
  breadcrumb sorting. Remove `navigation-state-default.toml`;
  query parameters no longer control the navigation view.
- Delivery settings use `data/delivery.toml`, with Module defaults in
  `data/banyan/delivery.toml`. Move `prefetch_runtime`, `speculation_rules`, and
  `service_worker` from Hugo `params` to this file; they apply to all languages.
  Tables merge by field; previous configuration entries are no longer accepted.
  Deployment fields use `platform.edgeone.makers`; route overrides use
  `http.edgeone.makers` and `http.cloudflare.pages`, with independent `http`
  and `sw` fields. SW uses only `sw.bucket` (`versioned`, `fingerprinted`,
  or `off`), supports one wildcard anywhere in a case-sensitive URL path, and
  gives later matching rules priority. The default covers same-origin GET
  requests, including JSON and XML. Versioned cache misses validate the HTTP
  cache; related-resource warmup selects only fingerprinted URLs.
  Site route arrays replace the defaults; the previous format is no longer accepted.
  Speculation rules publish under `/site/speculation-rules/` and share the
  default `/site/*` HTTP and SW cache policies.
  Remove the unused `/icon/*` immutable-cache rule.
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
- List fields use fixed widths. Long values stay within their fields;
  tooltips retain the full values. Name-only collections use one navigation
  column without reserving extra reading width.
  Custom list styles use `item-list`, `list-item`, `item-field`, and
  `item-control`; custom palettes use `--item-*` color roles. List field
  widths use `--item-*-inline` and `--item-field-gap`.

## Fixed

- Navigation sorting checks accept selectable text truncated by fixed field widths.
- Mobile aside checks evaluate each requested width without retained browser zoom.
- Cloudflare cache and XML CSP overrides explicitly remove inherited headers
  before setting their values, preventing conflicting values from being combined.
- Chapter navigation uses the current URL fragment when scrolling runs,
  so a pending chapter scroll cannot override a newer skip-to-content action.
