---
title: Unreleased
url: p/unreleased/
description: Unreleased changes to the Banyan theme and Skill.
lastmod: 2026-10-22
---

## Added

- Chinese guides and developer documentation at `https://banyan.swaw.com/`.
- Hugo Module at `github.com/SwawHQ/banyan/module`, with matching
  `swaw-banyan` Skill versions. `doctor [directory]` checks Module and
  theme-directory versions, vendored dependencies and local development.
  Local theme versions come from `theme.toml`. Doctor also checks selected tools
  and runtime launchers, including a damaged launcher or bindings file, and provides
  manual recovery steps. Ordinary tasks do not check pairing. Check switches and
  repair hints are maintained in `references/doctor.toml`. Extracted project ZIPs pair their built-in
  Skill and Module using `module/theme.toml`, without a `.git` directory.
  Recovery messages include the project URL,
  theme source ZIP and Module version commands.
- Windows x64 CLI with Node/npm, Git, Go, Hugo and optional Bun and GitHub CLI.
  uv and Python 3.13 support isolated Python scripts and CLI packages in the Skill,
  including sites that already use uv. The system PATH and Python registry stay unchanged.
  Portable downloads are checksum-verified. npm prepares parser packages
  on demand for `sync/ext` and content checks, isolated from parent workspaces;
  site builds need no npm dependencies.
- Name and product list views with shared column navigation and sorting.
  Site-owned directories and references organize products.
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
  `check/delivery` checks generated platform formats, fingerprint paths
  and published file names without reading resource bodies. HTTP `immutable` or
  SW `fingerprinted` can mark a fingerprint path independently.
  Use `--base-path`
  for subdirectory deployments; URL path characters and EdgeOne host redirects
  retain their platform syntax.
- `sync/ext` for declared external resources and `deploy/edgeone/sync`
  for generated deployment configuration.
- `deploy/cloudflare/cli` and `deploy/cloudflare/wrangler` run pinned Cloudflare
  CLIs with native arguments. Each has `ensure [--force]` and a local `check`;
  normal commands prepare packages as needed. Authentication uses each CLI's
  native per-user credentials or a shared API Token in Windows Credential Manager.
  Native configuration, sign-in credentials and storage remain CLI-managed;
  compatible sign-in from system installations can be reused.
  `auth/token/check` also finds manually added credentials.
  Resource names and explicit boolean flag values no longer change credential selection.
  `auth whoami` uses the same credential priority as resource commands.
  Native `CF_*` API credentials keep priority over the saved API Token;
  present `CLOUDFLARE_*` variables take priority over their aliases.
  cf and Wrangler commands, including page sign-in and status checks, use fixed
  `%TEMP%/swaw/banyan/cf/` and `%TEMP%/swaw/banyan/wrangler/` directories.
  The directories and caches persist. Local paths use these directories;
  use absolute local paths. For a project, pass Wrangler's native `--cwd`
  with an absolute project path.
  cf resource-management commands use an empty configuration; development and
  builds need an actual project configuration.
- `deploy/tencent/cli` runs a pinned tccli with automatic uv/Python preparation
  in an isolated Skill environment. It provides `ensure [--force]` and a local
  read-only `check`, preserving native Tencent Cloud and EdgeOne commands.
  Sign-in and credential refresh require TLS certificate verification.
  `auth/key/check` returns a nonzero exit code when the local credential is absent.
  Configuration and sign-in follow tccli's native rules. The page explains its
  plaintext sign-in storage and recommends API keys saved in Windows Credential Manager.
  tccli commands, including page sign-in and status checks, use the fixed
  `%TEMP%/swaw/banyan/tccli/` directory and retain its caches. Use absolute local paths.
- `deploy/auth/setup` opens one local authorization page for Cloudflare and Tencent
  Cloud, headed “Authorization Manager”, with a linked `Powered by banyan.swaw.com`
  credit below. The browser tab title is “Authorization Manager · Banyan”. Each platform's `auth/setup`
  entry selects its tab. The page supports
  native sign-in, Windows-stored API credentials and read-only environment status,
  including Cloudflare's native `CF_*` aliases,
  with credential priority, site icons in their original colors and system-language
  text in English or Chinese. A title-bar language switch preserves inputs and
  progress; reloading returns to the system language without saving the selection.
  Platform navigation and method tabs use a monochrome layout with a thin column divider.
  Credential priority sits below the authorization method tabs; Close follows the language selector on the same row.
  Supplementary notes follow the controls or variable table. Sign-in and API Token
  notes use numbered lists for setup, permissions and credential storage.
  Sign-in tabs prepare tools in the background, show readiness and support retry,
  then check existing cf and Wrangler sign-in and usable tccli native credentials,
  including after reload or reopening. tccli uses a native STS identity query
  with the same profile as sign-in;
  it does not distinguish stored sign-in from keys or check product permissions.
  Sign-in buttons show request progress immediately.
  API Token setup stays available during downloads and checks; Close stops preparation, checks and sign-in.
  The page no longer expires automatically; each CLI keeps its own authorization timeout.
  The page avoids browser-blocked ports.
  Cancellation still closes the session after a credential write if the save connection disconnects.
  Narrow screens stack the columns.
  Both platforms use the API Token tab label.
  Tencent access keys use `swban/tencent/default`; `auth/key/check` checks local presence.
- MIT licenses for the repository, Module and Skill, with third-party notices.

## Changed

- Require Hugo 0.168.0. Language configuration uses native `label` and `locale`;
  remove `params.locale` and keep language icons in `params.icon`.
  Restore SRI integrity checks for the Service Worker registration script.
- Always link the Web App Manifest through a standard head link; remove
  `params.web_app_manifest` and manual theme commit markers. Powered by shows
  only the site content version; enabled Service Workers read the same
  version from `sw-version.json` to switch content caches.
- Discover - Categories is an ordinary content directory at `content/discover/`.
  A shared `_map.toml` adds article references to other directories without
  copying content. Lists, counts, metadata and section RSS use the same membership.
  Remove the special `d` root and its permalink; move documentation to
  `content/discover/docs/` and remove the demo AI and tooling terms. Articles use
  explicit `url` fields such as `p/article-name/`, with their language prefix;
  retaining `url` preserves the published address when moving directories.
  Replace the required `slug` field and per-section permalink configuration with
  required page URLs; missing URLs fail the build. Enable Hugo's native duplicate
  output check in site configuration, replacing the manual URL audit and its mode
  setting while covering unlisted pages.
  The `discover` root avoids Hugo's default
  taxonomy names. Tools also use directories and references; remove native
  taxonomy configuration and article classification fields while retaining `offer`.
  The demo keeps an empty `[taxonomies]` table to disable default classifications.
  The theme allows native taxonomy configuration but does not provide taxonomy list layouts;
  taxonomy RSS uses Hugo's native page collections.
  Align aggregate RSS with list membership, omit non-HTML pages from hidden-directory lists,
  accept dotted content paths, and preserve special characters in navigation sources.
  Relation files follow Hugo's resource publishing settings; reference directories still validate unlisted ancestors.
  The demo links article source files.
- Skill tool commands use `base/<tool>`, `base/<tool>/check` and
  `base/<tool>/ensure`. The entry uses Node and prepares Node/npm and required tools
  on demand; Bun remains an independent tool. `base/ensure` is removed.
  Hugo and Go prepare Git as needed. The theme no longer enables unused Git page
  information. GitHub CLI is prepared when used.
  Run npm and npx with `base/node/npm` and `base/node/npx`.
  Python commands use `base/uv/python`, `base/uv/python/check` and
  `base/uv/python/ensure`; common help lists uv as the Python tool manager.
  uv accepts global options before commands; `run` and `pip` retain the isolated Python environment.
  Prepare parser packages with `base/packages/ensure` before working offline;
  use `--force` to reinstall. Doctor reports missing packages without installing them.
  Prepare browsers with `base/browser/ensure` and `base/browser/ensure.webkit`.
  `help/en [depth|path [depth]]` and `help/zh [depth|path [depth]]` list commands
  and categories or show full help. Depth can start below a selected path;
  lists retain full paths and mark categories with a trailing `/`.
  With no argument, help shows common commands, including
  build, preview and release examples.
  `help` selects the system language. Invalid help files report their path and
  the JSON parse reason or specific field.

- Use unified `[prefetch]` settings by icon and column scope, with
  conservative, moderate, eager and immediate levels. Scopes use `root`, `tail`,
  `"root+N"`, `"tail-N"`, and `all`; root navigation is column zero.
  Prefetch and prerender resolve independently; tail folder links default to
  moderate prerender. Select native rules,
  an active Banyan SW, or link automatically; optional scopes enable native
  prerender. Inline native rules use CSP hashes and wait for navigation and
  sorting. Initialize custom prefetch once, keep page URL deduplication and
  remove session gates. The diagnostic page provides per-page backend
  selection, reload testing and dispatch status; unconfigured icons use the default.
  Remove the invalid legacy URL count from prefetch size reports.
- Move the frontend `from`, `sort`, and `sorts` fields into URL fragments,
  preserving them in chapter links. Back and Forward restore the source and
  breadcrumb sorting. Remove `navigation-state-default.toml`;
  query parameters no longer control the navigation view.
- Delivery settings use `data/delivery.toml` in both the Module and site.
  Prefetch and Service Worker settings apply to all languages. Site declarations
  replace complete top-level fields, including nested tables and route arrays;
  copy the complete table to change it. Empty route arrays remove all default routes.
  Read delivery settings only from this file without reserving unrelated site
  parameters or data names. Accept standard HTTP token characters in field names
  while retaining control-character, type and duplicate checks. Delivery checks
  allow ordinary attachment formats; style checks inspect only CSS loaded by HTML.
  Deployment fields use `platform.edgeone.makers`; route overrides use
  `http.edgeone.makers` and `http.cloudflare.pages`, with independent `http`
  and `sw` fields. SW uses only `sw.bucket` (`versioned`, `fingerprinted`,
  or `off`), supports one wildcard anywhere in a case-sensitive URL path, and
  gives later matching rules priority. The default covers same-origin GET
  requests, including JSON and XML. Versioned cache misses validate the HTTP
  cache; related-resource warmup selects only fingerprinted URLs.
  Platform `enabled` switches control Cloudflare Pages `_headers`/`_redirects`
  and EdgeOne Makers `edgeone.json`; omitted platforms are disabled.
  Enabled SW builds also publish `sw-policy.json`, a copy of their path/bucket
  rules in matching order. Off and disable builds omit this copy.
  Remove the unused `/icon/*` immutable-cache rule.
- Sitemaps include rendered, indexable HTML pages regardless of `build.list`.
  Use native `sitemap.disable` in content front matter to exclude a page;
  remove `params.sitemap.include_pages`. Noindex pages and excluded translations
  stay outside sitemap entries and alternate-language links.
  Language `llms.txt` indexes use the same page set, grouped by content section
  with existing titles and descriptions. `check/llms` reports
  missing, unexpected or duplicate entries and broken index links.
  Each index follows its language home path and links other language indexes;
  the root index covers the default language, without a duplicate language-path copy.
- Distribute the theme from `module/`; keep the demo at the repository root.
  Each site owns its complete `hugo.toml`; remove the Module's default configuration.
  The repository root provides an example, including the LLMS output definition,
  language locale and icon settings, an explicit palette, and the minimum Hugo version.
  The demo declares EN, 简 and 繁 as its language markers.
- Use native Hugo for builds and previews, and native Git and GitHub CLI
  for releases.
- Build and minify JavaScript with Hugo, and generate CSP and deployment
  headers during the build. Sites must set `minify.disableJS = true`
  to preserve inline script hashes.
- Ordinary pages only register the Service Worker after load; prerendered pages
  wait until activation. The Powered by page owns PWA status and manual checks.
  The browser manages program update checks and activation. Links, refresh and
  history keep native behavior. The first visit does not receive extra cache warmup.
  Remove the `update_check_interval` and `update_visibility_throttle` settings.
  Publish content versions at the fixed `sw-version.json` URL, so content-only
  releases do not change `sw.js`. The SW checks 15 seconds after a successful
  navigation response. `service_worker.content_check_interval` sets the minimum
  interval in minutes, with a default of 5. A new content version switches caches
  and removes old content caches without reloading the current page;
  fingerprinted resource caches remain shared across versions. Waiting programs
  do not pause content checks. Program updates prepare offline pages before
  activation. Re-enabling restores the content version; reinstalling the same
  program refreshes its offline pages. Activation preserves newer offline pages
  cached during the waiting period and fills missing paths from prepared pages.
- List dates and date sorting use `lastmod`, then `date`. Git commits and
  filesystem times do not change editorial dates.
- List fields use fixed widths. Long values stay within their fields;
  tooltips retain the full values. Name-only collections use one navigation
  column without reserving extra reading width.
  Custom list styles use `item-list`, `list-item`, `item-field`, and
  `item-control`; custom palettes use `--item-*` color roles. List field
  widths use `--item-*-inline` and `--item-field-gap`.

## Fixed

- Cloudflare `_headers` generation rejects header names starting with `#`,
  preventing them from being silently treated as comments.
- Article structured data remains available when visible metadata is disabled.
- Custom palettes control article-title and list-header borders independently,
  while built-in palettes retain their current appearance.
  Site-owned palettes must define `--list-header-border` in `.list-header`.
- Invalid saved theme preferences follow the system theme from the first paint.
- Commands can reuse a prepared Python environment concurrently without installation-lock errors
  and accept uv's Python aliases within the managed installation directory.
- Build-version and browser prefetch checks accept the version JSON and valid empty inline rules.
- Prefetch diagnostics display configuration and runtime state without a registered Service Worker.
- Navigation sorting checks accept selectable text truncated by fixed field widths.
- Mobile aside checks evaluate each requested width without retained browser zoom.
- Browser checks retry local ports denied by the operating system.
- Cloudflare cache and XML CSP overrides explicitly remove inherited headers
  before setting their values, preventing conflicting values from being combined.
- Chapter navigation uses the current URL fragment when scrolling runs,
  so a pending chapter scroll cannot override a newer skip-to-content action.
