---
title: Unreleased
url: p/unreleased/
description: Unreleased changes to the Banyan theme and Skill.
date: 2026-11-06
lastmod: 2026-11-12
---

## Added

- Walls use a centered site SVG icon for missing covers, falling back to ICO. Independent section descriptions use body text size; titles are no longer repeated inside covers.

- Added `page-collection-wall` for mixed child sections, articles and references, and `page-collection-wall-all` for homepages and aggregate sections, with fixed-ratio, equal-width or equal-height images configured by `wall.size.width/height`, detail entry points by `details`, and scroll direction by `scroll`. Titles open details; covers open articles. Membership deduplication and home browsing sources are supported. Section cards use an icon and the shared details popover for descriptions and article counts; ancestor columns retain compact navigation.
- Reference site: the homepage uses wind art; Articles - Categories and its child sections use lists. Commented 300 × 125 wall settings identify the matching wall layouts.

- SVG favicons must declare a 32×32 default size or the build fails. The reference site adds a GitHub page with independent avatars. The first navigation column places GitHub before About, with About last. Its SVG, ICO, Apple touch and PWA icons use leaf green `#26861C`; the ICO contains one 32×32, 32-bit DIB image. Powered by shows the site icon after the theme name, at the same size as the home navigation icon; only the theme version text links to the project GitHub homepage.

- RSS subscription pages show the all-articles feed and category subscription instructions without enumerating categories. `rss-link` reads the actual feed address, and `site-root` provides the current language root for URL examples.

- Each language's homepage `title` supplies its site name. Remove site titles from `hugo.toml`. Browser title suffixes, RSS and `llms.txt` use the localized name; the shared PWA manifest uses the default language's name.
- `defaultContentLanguage` selects the default site. Changing language weights no longer changes the PWA manifest name, SEO default language or 404 default language.
- Language option icons now come from each translated settings page's `params.language_icon`. Remove language icon settings from `hugo.toml`; the settings navigation entry still uses `params.icon`.
- Appearance settings pages declare `auto`, `light` and `dark` icons in `params.appearance_icons`, using SVG names, text or images.
- The reference site provides English, Simplified Chinese and right-to-left Arabic. Traditional Chinese pages and its interface dictionary are removed. Simplified Chinese uses `zh-Hans`; RSS keeps the full locale tag, and Open Graph omits optional locale tags when no region is specified.
- The Module's `theme.toml` declares the minimum Hugo version. Sites no longer repeat `module.hugoVersion.min`.
- Chinese guides and developer documentation at `https://banyan.swaw.com/articles/docs/`, with release notes at `https://banyan.swaw.com/articles/changelog/`. The Banyan repository maintains their source under `content/articles/docs/` and `content/articles/changelog/`, released with the theme code. Both use ordinary article pages with `p/` URLs, dates, source links, chapters and RSS.
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
  `upgrade/version/current` reports the official comparison base from the active Module,
  vendor version. For local sources, HEAD must be verified against current official remote refs;
  an unverified source reports `old: null` and any declared candidate separately.
  Fixed false official-source reports caused by local Git history overrides.
  Local version inspection does not download missing Git objects, including in partial clones.
  `deploy/release/tag` validates committed Theme/Skill versions and uses native Go parsing for
  Module identity, then atomically publishes matching project and Module tags to origin;
  `--check` previews the plan. Submodule-recursion settings cannot suppress publication of the tag pair.
  Publication uses Git's native origin resolution to avoid repeated URL rewriting and checks the actual push destination.
  Version mismatches and existing tags report their values, fields or tag names in the system language,
  with steps to check prior publication, commit corrections and retry.
  `help` lists `upgrade/` and the four site roots to review before upgrading.
  `help upgrade/git` provides Git comparisons, subdirectory exploration, native pathspec globs
  and directory exclusions; unknown bases use a full review against the target reference site.
  Directory arguments use path placeholders. The help also explains how to update the complete
  matching Skill and verify the upgrade.
  uv and Python 3.13 support isolated Python scripts and CLI packages in the Skill,
  including sites that already use uv. The system PATH and Python registry stay unchanged.
  Portable downloads are checksum-verified. npm prepares parser packages
  on demand for `sync/ext` and content checks, isolated from parent workspaces;
  site builds need no npm dependencies.
- `page-collection-directory-name-only` and product lists share column navigation
  and sorting. Name-only lists occupy one column. Sites organize product categories;
  product fields show name, update time and price, with newest updates first.
  `params.offer.version` can remain as metadata; lists do not display or sort it.
  The `offer.value` benefit field is removed.
- Powered by shows the effective theme and Hugo versions, site build details and PWA status.
  Maintain headings, prose, source and changelog links in each language's Markdown
  body, using `new-tab` for external links. Remove `params.theme_changelog` and
  `params.theme_repo`. `theme-version` replaces `powered-by-theme` and outputs only
  the theme version; `hugo-version` shows the actual Hugo version.
  `site-status` accepts `version`, `content`, `interval`, `policy`, `offline` or `status` for the
  local version, server version, content-check interval, cache policy, localized offline-page link and SW status.
  The `interval` display text contains `%d`. `content` and `status` provide separate
  manual checks without activating a waiting SW or reloading the current page.
  The page owns `params.site_status.labels`. Prefetch diagnostics can use a separate
  page or body section, with copy in `params.prefetch_debug.labels`.
  Separate diagnostic links retain the default-language and deployment subpaths;
  their worker state reports only whether the diagnostic page itself is controlled.
  Site overrides must use the current reference body. The old `powered-by`
  shortcode and `powered_by` copy fields are removed.
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

- Collection pages show their list before the section title and body, in the same scrolling column. The title and body align with the name header, with less space above the body and around its headings. Pages without body content add no title or spacing.
- Article information controls use the `menu` icon from `assets/site/icons.toml` at the right of the title row, with a tooltip, accessible name and the existing expand and collapse behavior.
- Collection pages load their parent navigation sooner, reducing the empty-column interval. Main content does not wait for navigation to finish loading.
- Desktop columns and the horizontal canvas use native thin scrollbars with system buttons. The horizontal scrollbar and wheel help appear and hide together. Scroll, hover and horizontal-lock behavior and column gaps stay the same. Touch and forced-colors modes retain the system's default width.
- Section headings and article page titles use the body text color and a slightly heavier weight. Sort labels and secondary fields, including dates and sizes, use 87.5% of the base font size and scale with it. Name headers in the current list and breadcrumb-column headers use a `0.3em` start indent based on the header container's font size. Sort arrows stay after their labels. Text line height and ordinary list density stay the same. The first navigation entry after `weight` sorting uses the palette's header rule and keeps its original font weight. Custom palettes define `--list-header-border` on `.item-list`.
- The floating horizontal wheel arrow is removed; the bottom help line remains. Hovering does not enter locked mode. Left/right arrow keys also enter this shared mode while retaining native movement. After keyboard locking, the first wheel pans the canvas even if the mouse has not moved. Home/End and PageUp/PageDown enter it directly when the focused area has no native scroll target; vertically scrollable columns retain their keys even at either end. Each column has a named Tab stop and a focus outline; breadcrumb columns become focusable after loading. Home/End move to the canvas ends; PageUp/PageDown move by column, or by one viewport inside a wide column. Up/down arrows, Esc, Tab, Shift+Tab, Enter and Space exit without blocking their native action. Space and Shift+Space retain native paging; Enter and Space retain control activation. Controls and inner horizontal scrollers retain their keys. The wheel can pan the canvas from its native horizontal scrollbar, whose colors remain visible while locked; system overlay scrollbars can still hide. Shift+wheel on the native track no longer causes duplicate horizontal movement. During mouse input, a short help line at the navigation's starting edge appears during scrolling, scrollbar hovering or horizontal lock. Its text has a translucent background that follows the page theme and does not intercept page input. Touch input does not show mouse instructions. Site interface dictionaries must include `canvas_wheel_help`.
- Browser checks `nav/sort`, `palette/contrast`, `palette/roles`, `prose/layout` and `canvas/layout` require an explicit `--page`. Appearance and PWA navigation sources default to the home page.

- Require Hugo 0.168.0. Language configuration uses native `label` and `locale`;
  remove `params.locale`.
  Restore SRI integrity checks for the Service Worker registration script.
- Always link the Web App Manifest through a standard head link; remove
  `params.web_app_manifest` and manual theme commit markers. Powered by and enabled
  Service Workers share the content version in `sw-version.json` for cache changes.
  Build versions default to `v` plus a timestamp; `params.build.version` can set
  an explicit value. Remove the unused `version_prefix` and `timestamp_layout` settings.
- Content sections use ordinary directories and shared `_map.toml` references.
  Lists, counts, metadata and section RSS use the same membership without copying articles.
  Section names belong to each site. The Banyan demo uses `articles`, `articles-all`, `products`
  and `products-all` to show ordinary and product lists. The list and product examples share one article and one `_map.toml`;
  documentation and release notes also live under `articles`. The demo keeps its about page
  and its standalone GitHub entry. Swaw owns its
  `d`, `d-all`, `pr` and `pr-all` entries; Products - All uses `/pr-all/`.
  Remove theme-specific root and permalink conventions. Articles declare explicit `url`
  fields such as `p/article-name/`, with their language prefix; retaining `url`
  preserves the published address when moving directories. Replace required `slug`
  fields and per-section permalinks with required page URLs. Enable Hugo's native
  duplicate-output check, replacing the manual URL audit and its setting.
  Remove native taxonomy configuration and article classification fields while
  retaining `offer`. Keep an empty `[taxonomies]` table to disable default classifications.
  The theme allows native taxonomies but supplies no taxonomy list layouts;
  taxonomy RSS uses Hugo's native page collections.
  Align aggregate RSS with list membership, omit non-HTML pages from hidden-directory lists,
  accept dotted content paths, and preserve special characters in navigation sources.
  Relation files follow Hugo's resource publishing settings; reference directories validate unlisted ancestors.
  Demo articles link to their repository source.
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
  sorting. Initialize custom prefetch once after asynchronous navigation and
  sorting finish, so slow loads do not omit breadcrumb-column links. Keep page URL
  deduplication and remove session gates. The diagnostic page provides per-page backend
  selection, reload testing and dispatch status. The reference page uses English;
  sites maintain its interface copy in `params.prefetch_debug.labels`.
  Unconfigured icons use the default.
  Remove the invalid legacy URL count from prefetch size reports.
- Keep frontend `from` and `sorts` state in URL fragments, preserving it in chapter links.
  Use `sorts` for every breadcrumb column and the main list. Generated links omit default
  sorts and trailing default slots; keep `_` for default positions before another sort.
  Remove the separate `sort` field without reading or migrating it.
  Main-list sorting refreshes breadcrumb-column links so new tabs retain
  the latest order. Breadcrumb-column headers show only the sort field and direction.
  Matching parent entries, including root entries, retain the expanded column's current sort.
  Back and Forward restore the source and each column's sorting.
  Sorting category and aggregate lists no longer adds a
  redundant `from`; article links retain their required non-default source.
  Remove `navigation-state-default.toml`;
  query parameters no longer control the navigation view. Breadcrumb columns load shared,
  fingerprinted `.txt` HTML fragments under `/site/navigation/`. Root navigation,
  main collection lists and articles retain HTML and work without JavaScript.
- Each site owns its complete root `assets/site/delivery.toml`, using the Banyan root
  reference file as a starting point and retaining its own policy values.
  The Module and traditional theme directory no longer supply delivery settings
  to merge or inherit. Prefetch and Service Worker settings apply to all languages.
  The site declares its complete ordered routes; an empty array declares none.
  URL redirects use top-level `[[redirects]]` entries in the same file and retain
  declaration order. Omit them for no rules; the Banyan reference provides only a
  commented example.
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
  SW `enable` requires a published HTML offline page for each enabled language;
  `off` and `disable` allow those pages to be absent.
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
- Distribute the theme from `module/`; start new sites from the complete root reference site.
  Each site owns all pages under root `content/`, including Powered by and prefetch
  diagnostics; the reference site keeps all of them. Internal pages use `content/_res/`
  with a shared `_index.md` that excludes navigation and site discovery. Offline pages
  use `page-offline`, keeping prose, theme and retry without navigation, SW management
  or prefetch scripts. Existing sites copy the pages
  they need from the reference root. The Module supplies reusable layouts, scripts
  and styles, without content defaults or page fallbacks.
  The site owns `archetypes/banyan.md`; the Module and theme no longer supply
  article templates. Replace `--kind blog` with `--kind banyan` for new articles.
  Site favicons, four PWA PNG icons, the complete manifest template and optional brand
  media now belong to root `assets/site/`. The Module and traditional
  theme directory no longer supply these files. Existing sites must add root
  `assets/site/` before using the theme. Each site maintains
  `assets/site/manifest.webmanifest.tmpl`; the Module only reads and executes it
  to publish `/site/site.<hash>.webmanifest`. Images publish under `/site/*`.
  Complete palettes belong to root `assets/site/`; the Module no longer supplies
  `css/theme.css`. The reference site selects `site/theme.css`:
  selection and hover share a 4% foreground fill in light mode and 10% in dark mode,
  with square corners and a 2px current-item start marker. Unselected monochrome list icons use 70% opacity;
  current items, text icons and color images stay unchanged. Non-current sort arrows use 50% opacity;
  the current sort arrow stays at 100%.
  Select `site/theme.high-contrast.css` to
  use the same high-contrast fill for selection and hover, with inverted text and monochrome icons,
  700-weight selected names and square item corners.
  A `page-home` homepage uses `home-art` in its body
  to reference a hidden leaf bundle under `content/_res/home-art/<theme>/`.
  Translated art pages own scene copy and parameters; `params.styles` and
  `params.scripts` select CSS and JS from the bundle. Wind scenes use
  a bundle-local `scene.html.tmpl`, selected by `params.template`. Keep scene
  calculations, HTML, CSS and JS in the bundle; new scenes need no Module changes.
  Copied bundles use their own resource publication paths.
  Templates place Markdown body content with `.Content`. The host homepage's
  `params.show_navigation` controls root navigation; the palette controls colors.
  Favicon sources use `assets/site/`. Prefer `favicon.link.svg` over `favicon.link.ico`
  and emit a fingerprinted icon link only for the selected file. Publish `favicon.ico`
  separately at its fixed root URL, without an automatic icon link. At least one
  favicon source, the four PWA PNG files and the manifest template are required.
  The authorization page reads the same directory and prefers linked SVG, linked
  ICO, then the fixed ICO; without these files, it shows no logo.
  Each site also owns `assets/site/icons.toml` and `assets/i18n/` interface dictionaries.
  The project's `hugo.toml` mounts `assets/i18n` to `i18n` with native Hugo settings.
  Maintain `assets/site/external-resources.yaml` when used.
  The Module and traditional theme directory do not supply these settings or dictionaries.
  Existing sites must supply these files from the root reference site.
  Adding or removing a language requires matching `hugo.toml` settings,
  interface dictionaries and required content translations.
  Each site owns its complete `hugo.toml`; remove the Module's default configuration.
  The repository root provides an example, including the LLMS output definition,
  language locales and an explicit palette.
  The demo declares EN, 简 and ع as language markers, including right-to-left Arabic.
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
  releases do not change `sw.js`. The SW starts an independent background check
  on navigation. `sw.content_check_interval` sets the minimum
  interval in minutes, with a default of 5. A new content version switches caches
  and removes old content caches without reloading the current page;
  fingerprinted resource caches remain shared across versions. Waiting programs
  do not pause content checks. Program updates prepare offline pages before
  activation. Re-enabling restores the content version; reinstalling the same
  program refreshes its offline pages. Activation preserves newer offline pages
  cached during the waiting period and fills missing paths from prepared pages.
  An updated program resets the content-check time on activation, so the next
  page navigation checks the version without waiting for the previous interval.
- List dates and date sorting use `lastmod`, then `date`. Git commits and
  filesystem times do not change editorial dates.
- List fields keep fixed widths from first paint. Long values are clipped without
  shrinking text; tooltips retain the full values.
  Custom list styles use `item-list`, `list-item`, `item-field`, and
  `item-control`; custom palettes use `--item-*` color roles. List field
  widths use `--item-*-inline` and `--item-field-gap`.

## Reference site examples

- Add a `minimal` home art bundle with English, Chinese and Arabic text, Markdown bodies, a small HTML template and CSS. No JS is needed. The default home still uses wind. This example requires no migration.

## Upgrade migration

- Sites with previous wall options → section or home `_index*.md`, `params.wall` → replace `layout` and numeric `size` with `size.width/height`: `auto/previous size` for equal height, `previous size/auto` for equal width, or two dimensions for a fixed ratio. Replace `caption` and `controls` with `details: title|overlay|overlay-hover`; remove the old fields.

- Sites using art bundles → `content/_res/home-art/<theme>/index*.md` and bundle templates → set `params.template: scene.html.tmpl`, remove scene shortcodes from the body, and move scene HTML and calculations into that template. Use `htmlEscape` for text and HTML attribute values; output `.Content` where body content belongs. Wind sites can copy the current reference bundle template.

- Sites using the wind art bundle → `content/_res/home-art/<theme>/index*.md` → rename `params.home_signals` to `params.signals`, `params.home_signal_*` to `params.signal_*`, and `params.home_wind_field_start_offset_rem` to `params.wind_field_start_offset_rem`. Signal objects use `name`, `url` and `primary`; merge `title` or `label` into `name`, and rename `href` to `url`.
- Sites with custom wind styles or template overrides → art bundle CSS/JS, `assets/site/theme*.css` and `layouts/` → replace wind classes `.page-home` and `.page-home__*`, variables `--page-home-*` and the `data-page-home-signal` marker with the current reference bundle's `home-art-wind` names. Use `--home-art-wind-field-*` for the old `--page-home-wind-field-*` variables, and `--home-art-wind-signal-*` for `--signal-*`. Merge custom shortcode and model code into the bundle's `scene.html.tmpl` and remove the old overrides.
- Sites overriding page actions → `layouts/` and `assets/js/` → use `pages/back.js` for back links and `pages/reload.js` for reload links.
- Sites overriding breadcrumb components → `layouts/`, `assets/js/` and custom CSS → match the current Module's `breadcrumb-*` scripts and `.breadcrumb-navigation` and `.breadcrumb-column` styles. Article directory chains use `.document-meta__row--breadcrumb` and `.document-meta__breadcrumb`. Use `feature-browse/navigation/breadcrumb/` for model overrides and `system-metadata/seo/breadcrumb-list.html` for the SEO template override. Column markers are `data-breadcrumb-column`, `data-breadcrumb-column-path` and `data-breadcrumb-collection-href`; sorting and failure markers are `data-breadcrumb-sort-toggle` and `data-breadcrumb-failed`; loading markers are `data-breadcrumb-pending` and `data-has-breadcrumb-columns`. Keep the `breadcrumb` value in `params.slots`.

- Sites using the old site status controls → page bodies, front matter and same-path template overrides → replace `site-update` with `site-status` and `params.site_update.labels` with `params.site_status.labels`; use the current Module resource paths and DOM markers in template overrides. Old names are not supported.

- Sites using `favicon.link.svg` → `assets/site/favicon.link.svg` → set `width="32" height="32"` and retain the artwork coordinate system in `viewBox`; callers can still request other display sizes.

- The product-list and horizontal keyboard changes require no site migration. Existing `params.offer.version` values can remain.

## Fixed

- Unified wall sizing: size is the maximum, with no enlargement. Regular tracks may shrink by up to 20% to fit an extra row or column; otherwise space stays blank. A single oversized card may shrink further to fit. Equal-height vertical walls shrink only oversized cards, without reducing every other card. Wall covers now publish under `/media/content/` to use the configured fingerprint cache rules.

- Printed columns fit the paper width. Long code and table contents wrap without clipping at the right edge. Separate code line-number columns are hidden in print because they cannot align with wrapped code.
- Prose headings retain the spacing adjustment for text line boxes next to quotes, tables, code and images. Collection bodies use compact spacing. Responsive and ordinary images share the same spacing and match code and quote gaps next to paragraphs; inline images no longer trigger image-paragraph gaps. Article title spacing no longer depends on metadata or JavaScript. Quote, code, table and caption fonts scale with the base size.

- Content links resolve pages and attachments before adding the deployment subpath; default-language links follow their published directory. Bare percent signs in links no longer stop builds. Inline links preserve adjacent text without extra whitespace.
- Shared deployment files are generated when the default language publishes only RSS and another language publishes HTML.
- Column URL checks and shared navigation handle literal percent signs in deployment directories. Names such as the literal directory `a%20b` remain unsupported because Hugo emits an ambiguous relative URL; builds reject them explicitly.
- HTML checks preserve `>` inside quoted attributes and skip attribute-like text inside their values, avoiding false link and anchor reports or missed broken links. Resource paths resolve deployment prefixes containing Chinese characters, spaces or percent signs.
- Canvas end spacing fits the visible reading columns, including with JavaScript disabled. Document information opens reliably after scrolling on mobile. Root and path lists fit the width left by vertical scrollbars, avoiding inner horizontal scrollbars. Code blocks allow the browser to pass horizontal scrolling to the outer canvas at either edge; the browser determines the handoff behavior.
- Cloudflare `_headers` generation rejects header names starting with `#`,
  preventing them from being silently treated as comments.
- Article structured data remains available when visible metadata is disabled.
- Default, high-contrast and Rose palettes remove lines and border space below the first
  navigation item, list headers and all `h1` headings. Each palette CSS includes commented
  examples to restore the lines. List and `h1` borders can be configured separately.
  `--list-header-border` on `.item-list` and `--prose-heading-border` on `.prose` now use complete declarations such as `1px solid #888`. Use `none` to remove the line and its space, or `1px solid transparent` to retain the space. Update color-only values in custom palettes. Collection layout checks accept hidden, transparent and custom list-header borders.
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
