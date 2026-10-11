# Changelog

All notable Banyan theme changes are tracked here.

The root site may keep its own changelog for site-specific content and
deployment decisions. This file is for reusable theme behavior, release notes,
and migration decisions.

## [Unreleased]

### Added

- Skill release metadata and `check/module` for matching Hugo Module versions,
  vendored dependencies and same-checkout development. Document Skill-first and
  Module-first installation and paired repository/module release tags.

- Include matching MIT licenses in the repository root, Hugo module and
  swaw-banyan Skill, with WY Swaw LLC as the copyright holder. Correct the
  theme's license link and retain third-party license notices.

- Optional `gh.ensure`, `gh.check` and native `gh` commands. Reuse compatible
  GitHub CLI or install a pinned, checksum-verified portable copy. Release
  examples use native GitHub CLI with `--verify-tag`.

- Browser CSP checks reject preload credential mismatch warnings. Chromium
  canvas opening supports real touch dragging through --drag; WebKit retains
  taps. Scenario launch options use shared context, trace and cleanup handling.
  Consumer browser checks now live under tests/browser with site facts local.

- Retain original article directory metadata during browser first-paint checks.
  Reject runtime link, label and removal faults in Chromium and WebKit. Site
  suites now use one explicit build entry without npm or legacy dev launchers.

- Added `check/browser/site` with representative page discovery, shared checks,
  explicit skipped coverage and temporary SW update builds. Removed the demo's
  duplicate browser entries and implicit latest-build selection.

- Added shared Skill scenario execution with explicit site scenarios/builds,
  prepared browser selection, isolated contexts, incremental reports and traces.
  Suites and task checks use one static server and report-containment guard.
  Await document/header switches, record actual engines and close the server
  after launch failures. WebKit suites need no installed Chromium. Remove two
  legacy runners/servers/report writers, root Playwright declarations/locks and
  duplicate browser installer/help entries. Collections and native BFCache use
  the same prepared engines; site composition keeps paths and content facts.

- Added Chromium nav/tabs, nav/roots and img/load checks for native new-tab
  clicks, opener isolation, root selection/history and visible/lazy decoding.
  Destination responses are local; source documents and history must survive.
  Root assertions now share nav/_shared across opening, first-paint and settings.
  Consumer information pages retain account, avatar and brand requirements.
  Independent faults reject empty matches, changed targets/history/selection
  and broken/hidden images. Generic checks now cover all 66 consumer scenarios.

- Extended canvas/open with declared source/root checks, retained ancestor and
  sibling rows, coherent selection and sorting through reload/Back/Forward.
  Hidden directories and product categories share the existing command. Consumer
  metadata and tool-category journeys retain their authored paths and viewport.
  Independent faults cover wrong roots/order/selection/sort and broken history.

- Extended canvas/layout with root visibility, a single root navigation and
  explicit viewport height. Extended first-paint to static articles/settings
  with --root path|none, selected/aria-current agreement and ordered root-list
  retention before and after held scripts. Failure reports include both states.
  Consumer root scenarios now reuse these checks and shared native-history
  assertions; remove fixed delay and repeated root-list facts. No new commands,
  theme runtime changes or reading-position storage.

- Added Chromium `check/browser/canvas/touch` with explicit article/next paths.
  Use real mobile gestures for root links, prose and metadata; reject accidental
  navigation and horizontal reading resets, and verify vertical input and native
  Back. Share the gesture with consumer drag-then-open journeys. Both CSP engines
  now accept --page (default /). Remove duplicate legacy security collectors;
  source faults and consumer integration retain the original behavior boundaries.

- Added Chromium `check/browser/prefetch/rules`, `overlap` and `debug` tasks.
  Match accepted rules to the actual document loader and browser request ID;
  reject MIME/parser failures even when page JS fetches the JSON successfully.
  Verify owned-slot suppression while preserving unowned eager/focused actions.
  Compare diagnostics to page payloads with localized loading text and partial
  ownership. Both repositories now keep only scenario composition in the old
  speculation entry. Source faults cover delivery, coordination and diagnostics;
  no theme runtime or cache policy changes.

- Added Chromium `check/browser/pwa/disable` with enable/disable builds and an
  explicit page. Verify worker cleanup before reload, then independent manager
  cleanup and unregister with fresh caches. Preserve unrelated cache contents,
  other scopes and site storage; release page control on a further reload.
  Consumer wrappers reuse the check. Fault fixtures separate worker/manager
  failures; no theme runtime or cache policy changes.

- Added Chromium PWA check/activate/native/cancel/timeout/error/language tasks.
  Require two explicit SW builds at one origin; switch files and headers together.
  Merge hidden controls into manual checks. Preserve native waiting behavior,
  reader drafts and failure-path caches; detect delayed reloads/canceled redirects.
  Test cross-document middle/modifier clicks so same-document guards cannot mask
  a broken native-input boundary.
  Consumer wrappers reuse the same checks. Fault fixtures use custom paths and
  labels. No theme runtime or cache policy changes.

- Added Chromium `check/browser/pwa/offline` for real registration, first-page
  HTML/CSS/JS caching and offline reload after clearing HTTP cache. Verify worker
  revalidation/cache exclusion and actual disabled navigation preload; merge
  the duplicate preload source-text scenario. Allow workers explicitly in the
  shared runner while UI checks keep blocking them. Source faults remove
  warming/scanning, change cache names or break worker/navigation/header policy;
  unique page assets prove scanning beyond install-time fallbacks.
- Added Chromium `check/browser/pwa/panel` with explicit paths and widths for
  localized status/control text, accessible announcements, button state and
  visit/reload/Back/native entry. Keep service workers blocked and actual worker
  lifecycle checks separate. The consumer reuses this leaf for three languages;
  source fixtures use custom paths/copy and verify broken rendering/history.
- Added `check/browser/settings/url` and `settings/history` for unused URL/state,
  settings chains, native tabs and no-history language homes. Extend the existing
  language return check with native middle-click choices; wait for the target
  URL after tab creation. Keep consumer paths and sort/selection facts in site
  wrappers. Test independent settings paths and failed URL/history/tab behavior;
  add no WebKit variants or theme runtime changes.
- Added `check/browser/language/bfcache` with two real persisted restorations,
  explicit source/target paths and an optional second language. Use the prepared
  Chromium and shared reports/traces; reject ordinary Back and broken persisted
  handlers in source fixtures. Merge optional label failure, invalid JSON and
  mismatched metadata into `language/return`; remove the duplicate consumer
  code-only scenario. Keep the current data contract and native navigation.
- Extended `language/return` to retain untranslated sources with one accessible
  language notice, and verify no-choice Back, tab isolation, canceled choices
  and unavailable sessionStorage. Keep these contracts in separate leaf files;
  reuse the same command and Chromium. Test independent untranslated content,
  localized labels and broken notices/storage/history. Consumer paths and
  Chinese-copy assertions remain in swaw.com; old writers and BFCache stay separate.
- Extended `language/return` with explicit source/translation visits and reloads
  under a different browser locale, with and without pending return state.
  Wait for page lifecycle, navigation initialization and painting. Consolidated
  two retired recommendation scenarios into existing consumer return cases;
  removed their fixed delay. Test redirects, prompts, wrong reload language and
  failed pending-state cleanup without adding a command or WebKit entry.
- Extended existing browser checks: `nav/sort` verifies full date/name tuples
  and second-level keys; `prose/layout` isolates ordinary tables from Chroma;
  `breadcrumb/sort` validates prefetch markers after hydration and each toggle.
  Consolidated consumer copies without adding commands or WebKit entries.
- Extended `aside/style` to check metadata row spacing and taxonomy hover
  backgrounds. Site-specific metadata values stay in consumer static checks.
  Test uneven row spacing in Chromium and WebKit with independent fixtures.
- Added Chromium-only `language/choices` and `language/return` checks. Read
  published settings and alternate links; verify native/no-JS choices,
  accessibility, repeated history replacement and translated returns with
  source/query/fragment state. Consolidated consumer duplicates while retaining
  site language markers, routes and selected roots. Moved controller loading
  boundaries to `check/html/scripts` and removed the old browser scenario.
  Test independent translations and deliberately broken output with Bun/Node.
- Added Chromium-only `collection/layout` and `collection/style` checks with
  explicit page, source-article and appearance paths. Separate name/header/row
  geometry from selection, hover and keyboard focus across root, path, main and
  choice controls. Three swaw.com scenarios now reuse these leaves and retain
  their route and mobile-canvas expectations locally. Removed duplicate paint
  assertions and mixed DOM sampling. Test independent collections, translations
  and deliberately broken output with Bun and Node.
- Added the Chromium-only `breadcrumb/header` check for long labels, sort
  visibility and spacing. Extended `canvas/layout` for declared widths, shared
  gaps and one document scroller; extended `canvas/first-paint` for collection
  row order and header spacing. Four swaw.com scenarios now compose these
  checks, keeping route and 15rem expectations in the consumer. Removed old
  capture helpers and fixed waits. Test independent deep paths and broken
  output in both engines without adding a new WebKit command.
  Local browser servers now use dynamic-range ports to avoid blocked service
  ports such as 6667.
- Added Chromium checks for `breadcrumb/sort`, `breadcrumb/isolation` and
  `breadcrumb/source`, with declared paths and generated help. Check retained
  nodes, focus, scroll continuity, independent columns and static/runtime source
  links. Reuse the in-place sort contract and test broken outputs with independent
  content fixtures. Six swaw.com scenarios now compose these checks and retain
  their metadata, icon, language and taxonomy requirements locally.
- Added `canvas/open` and `canvas/first-paint` browser checks, each with explicit
  `.webkit` entries and generated help. Hold external scripts until the initial
  sample, compare reserved nodes and geometry, retain opening/current-entry and
  subsequent history checks, and let consumer gesture journeys reuse the same
  opening assertions. Replace duplicated fixed-delay scenarios and retire old
  first-layout helpers. In-place sorting now checks for absent navigation
  records. Test broken pages and independently supplied article fixtures.
- Added `canvas/scroll`, `canvas/scrollbar` and `canvas/history` browser checks,
  each with an explicit `.webkit` entry and generated help. Derive scrolling
  ranges from published columns, test collections without an aside, check
  scrollbar activity and geometry through resize, and verify native history
  and in-place sorting. Report native scrollbar-color support. Consumer suites
  reuse the checks and retain site-specific content requirements. Test broken
  fixtures with both runtimes and browser engines.
- Added separate browser checks for aside toggle, chapters, layout, style and
  print, plus canvas layout. Each has an explicit `.webkit` entry, declared
  page/viewport options and generated help. Toggle supports real taps in a
  mobile context and holds its controller until collapsed output is observed.
  Derive navigation geometry from published pages; keep site counts, taxonomy
  values and labels in consumer tests. Test failures with isolated long articles.
- Added separate browser checks for `nav/sort`, `nav/anchors`, `nav/keyboard`
  and `prose/layout`, with generated help. Sort uses Chromium; the other checks
  also have explicit WebKit entries.
  Read declared collection columns and groups, retain cell/DOM checks, require
  an article path for anchors, and use a settings page for default keyboard
  traversal. Existing suites now reuse these checks; keep settings script
  boundaries in a separate file. Test broken fixtures in Chromium and WebKit.
- Added separate browser checks for `palette/contrast`, `palette/roles` and
  `appearance`. Roles uses Chromium; contrast and appearance also have explicit
  WebKit entries. Declare page paths and
  contrast thresholds alongside generated help, measure published styles and
  generic preference behavior, keep logo checks in the consumer, and reuse
  assertions in existing suites. Palette source tests now use Skill browsers
  and retain their historical 5:1 source guards. Wait for actual color
  transitions before sampling instead of a fixed number of frames.
- Added `ensure/browser.webkit`, `check/browser/home.webkit` and
  `check/browser/csp.webkit`. Install WebKit only on request, share the locked
  Playwright dependency and check logic, select engines in explicit entries,
  and include engine/version in browser reports. Missing engines fail without
  automatic downloads or engine fallback.
- Added `ensure/browser`, `check/browser/home` and `check/browser/csp` with
  Skill-owned Playwright/Chromium dependencies, explicit build selection,
  optional screenshots/traces, and one parameter declaration for parsing/help.
  Existing browser suites reuse the new checks; remove theme smoke wrappers.
- Added `sync/ext` and `deploy/edgeone/sync` Skill tasks. Bundle the locked YAML parser
  so resource sync needs no site npm dependencies; split registry, download
  and validation, preserve failed or identical targets, and remove old scripts.
- Added fine-grained Skill checks for HTML, sitemap, robots, LLMS, images,
  prefetch, build versions, CSP, SRI, content declarations and HTTP responses.
  Split reports into `report/size/*` and `report/payload/*`; remove broad HTML
  commands and old theme scripts. Parse YAML/TOML/JSON front matter, read
  resolved Hugo configuration, keep inheritance in Hugo, and share HTTP
  security assertions with browser tests. Bundled parsers need no site npm
  packages. Move source/config integration tests into domain directories under
  `tests/`, isolate their caches and fixtures, and clean them after execution.
  Retired-output guards remain repository tests.
- Added `swban ensure` to bind a compatible Bun or Node without requiring both.
  Tool preparation reuses compatible installations or downloads verified
  portable versions; `--force` selects portable copies. Added Git preparation,
  checks and execution, shared by Go and Hugo.
- Display the effective Hugo Module version on Powered by, with localized local
  development labels and dirty status scoped to the theme module directory.
- Added multilingual product-all and category roots with four sibling price
  and origin views, plus browser coverage for product entry lineage and history.
- Added a multilingual site-information section and a `section-index` layout
  that lists direct children by weight using the shared collection rows.
- Added a release migration plan for separating theme-owned files, site-owned
  overrides, and example-site resources.
- Recorded the 2026-06-11 root-site release audit baseline, current resource
  classification snapshot, first production-content cleanup, and root-owned
  content inventory handoff.
- Rebuilt `exampleSite` as a minimal consumer site with structural Hugo config,
  taxonomy roots, and one demo article.

### Changed
- Remove the obsolete local 404 proxy. Preview the demo with native Hugo;
  keep source tests in tests/ and site-specific browser composition in consumer tests.
- Keep EdgeOne config sync in Skill deploy/edgeone/sync. Use native Hugo for
  hosted builds without the Skill; remove the deployment build wrapper and
  legacy hosting/npm Hugo helpers. Generate hugoVersion for EdgeOne and stop
  assuming npm or submodules in theme install defaults. No upload command is added.
- Keep source/configuration tests only in the Banyan repository. Move consumer
  palette, prose, home, security, prefetch and PWA composition to site scripts;
  remove duplicate legacy theme tests and helpers. Share page/navigation waits
  through the Skill without changing scenario IDs, order or runtime behavior.
- Run navigation/prefetch source tests through the selected Hugo js.Build,
  including real @params and the collection bundle boundary. Use Skill Hugo
  for local preview; remove root npm files/cache and unused Hugo helpers.
- Resolve the current fragment when a queued chapter reveal runs, so a newer
  skip-to-content navigation cannot be overridden by a stale heading target.
- Publish modules with native `swban git tag` and `swban git push` examples;
  remove the release commands and their custom validation/publishing workflow.
- Use `swban hugo` for native production builds and development previews. Remove
  build/dev wrappers, automatic Git metadata injection and root npm shortcuts;
  document common Hugo commands in both help languages.
- Use js.Build for all theme JS production minification. Generate CSP hashes and
  deployment headers in Hugo; remove CSP post-processing. Consuming sites must
  set minify.disableJS=true in their root configuration.
- Publish the theme from `module/` as `github.com/SwawHQ/banyan/module` and move
  the runnable demo to the repository root, using a local Go module replacement.
- Refresh the demo sitemap paths and editorial Lastmod policy to the current
  theme contract; keep production minification and Hugo-generated CSP explicit.
- Set the default multilingual RSS entry weight to 100.
- Kept generic browser contracts and the shared runner in Banyan while moving
  consumer-specific journeys to the site; removed legal-asset and domain
  assumptions from collection and image delivery checks.

- Replaced the Updates directory with a Powered by overview: Banyan/Hugo credits,
  source and change-log links, actual build metadata, and inline PWA status and update checks.
- PWA checks now only check for updates. Ready versions activate before ordinary
  same-tab site navigation; checks never reload the page or apply an update.

- Separated product price classification from origin so free and paid filters
  include both first-party and third-party products. Removed the old nested
  product navigation tree and its special root-matching strategy.
- Kept static section-index ancestor menus in page-weight order when restoring
  entry breadcrumbs, without assigning them the descendant collection type.
- Aligned section index headings and column widths with the shared collection
  styles, keeping site-information lists compact on desktop and narrow screens.
- Moved default about and changelog bundles under `content/site/`, preserving
  their public URLs and updating navigation, footer, and agent-access lookups.
- Made security, HTML audit, browser regression, and speculation-rules checks
  less dependent on swaw.com-specific defaults.
