# Source tests

Run from the Banyan repository root. Use `.\swban.cmd` on Windows or
`sh ./swban` on Linux x64 and macOS x64/ARM64. The commands below use the
[`swban` shorthand](../content/articles/docs-start/getting-started/index.zh.md#取得站点).
Run `swban base/packages/ensure` and prepare Hugo, Go and Git first.
Browser suites also need the Skill's Chromium and WebKit. Tests use system
temporary directories and remove their fixtures;
Hugo caches and resources stay there. They do not change site content or Git state.

## SW acceptance

Run this suite from the Banyan repository root after changing `module/assets/deploy/policy.toml` or the code that generates `sw.js`. The fixtures build the local Module, check both platforms' generated cache headers, and use Chromium to verify controlled offline navigation, cache buckets, content updates, worker activation and disable cleanup. They prepare both builds for each update scenario.

```powershell
.\swban.cmd base/node --test --test-concurrency=2 tests/cache-policy.test.mjs tests/browser-pwa.test.mjs tests/browser-content.test.mjs tests/browser-update.test.mjs tests/browser-disable.test.mjs
```

## Full source tests

Run root suites with Node, except `tools.test.mjs`. Select the files explicitly
in PowerShell:

```powershell
$taskTests = Get-ChildItem ./tests -Filter '*.test.mjs' -File | Where-Object Name -ne 'tools.test.mjs'
.\swban.cmd base/node --test $taskTests.FullName
.\tests\tools.ps1
```

Run `tools.ps1` with Windows PowerShell 5.1. It compiles a native fixture
and uses Bun's test runner to test Node-based tool preparation.
Tool fixtures do not log in or publish.

Generic package, archive, help, doctor, theme resolution, robots, delivery, fingerprint
and asset-report tests ship with the Skill:

```powershell
$skillTests = Get-ChildItem @('./.agents/skills/swaw-banyan/tasks/_shared/_tests','./.agents/skills/swaw-banyan/tasks/_shared/tools/_tests','./.agents/skills/swaw-banyan/tasks/check/delivery/_tests','./.agents/skills/swaw-banyan/tasks/check/robots/_tests','./.agents/skills/swaw-banyan/tasks/sync/resources/_tests','./.agents/skills/swaw-banyan/tasks/doctor/_tests','./.agents/skills/swaw-banyan/tasks/help/_tests','./.agents/skills/swaw-banyan/tasks/upgrade/version/current/_tests','./.agents/skills/swaw-banyan/tasks/deploy/release/tag/_tests','./.agents/skills/swaw-banyan/tasks/report/size/assets/_tests') -Filter '*.test.mjs' -File
.\swban.cmd base/node --test $skillTests.FullName
```

| Suite | Responsibility |
| --- | --- |
| `search.test.mjs` | Full build, search resource isolation, CSP, realtime results, cancellation, languages and deployment subpaths |
| `module.test.mjs`, `js-build.test.mjs` | Module/theme pairing, Hugo resolution and JS build inputs |
| `install.test.mjs` | Documented starter, isolated Module/Skill packages and site overrides |
| `cache-policy.test.mjs` | Delivery configuration, platform output, worker matching, versioned caching and controlled-navigation warmup |
| `tasks.test.mjs`, `checks.test.mjs` | Dispatch, streams, sync faults, help, arguments and static/HTTP checks |
| `browser.test.mjs`, `browser-site.test.mjs` | Engines, CSP, discovery, reports, isolation and cleanup |
| `browser-{aside,breadcrumb,canvas,collection,nav,opening,presentation,wheel}.test.mjs` | Navigation, geometry, native input and first paint |
| `browser-{language,settings,ui}.test.mjs` | Translation, history, preferences and palette |
| `language-icon.test.mjs` | Target-language option icons, independent entry icons and bundle images |
| `appearance-icons.test.mjs` | Page-owned appearance icons, bundle images and required icon values |
| `locale.test.mjs` | Script locales, RSS language tags and region-only Open Graph metadata |
| `responsive-images.test.mjs` | Image processing, browser selection, original links and build-cache reuse |
| `home-art.test.mjs` | Wind shortcode instances, translated content, resource isolation and home navigation |
| `browser-{pwa,content,update,disable,prefetch}.test.mjs` | Registration, native worker activation, controlled offline navigation, content versions, cache ownership and prefetch |
| `browser-nav-fragments.test.mjs` | Shared column loading, slow responses, source races, failure retries and visited-path offline reload |
| `output.test.mjs` | Repository budgets and retired-output faults |
| `sitemap.test.mjs` | Sitemap/LLMS parity, native exclusions, language routing and rebuilds |
| `archetypes.test.mjs` | Create content from each layout archetype and verify the Powered by diagnostic fields and calls |
| `directory-references.test.mjs` | TOML references, native taxonomy configuration, multilingual membership, feeds, canonical outputs and rebuilds |
| `column-urls.test.mjs` | Directory-based column URLs, rejected overrides, article URLs and multilingual normalization |
| `collection-structure.test.mjs` | Section-only collection layouts, rejected regular pages and preview validation |
| `aggregate-time-ranges.test.mjs` | Manual aggregate ranges, exclusive tree membership, validation, feeds, source navigation and preview rebuilds |
| `site-title.test.mjs` | Localized homepage names, metadata, shared PWA manifest and required titles |
| `reference-site.test.mjs` | Reference-site ownership, documentation links and sources, feeds, production discovery and build metadata |

Each suite keeps its successful cases and fault fixtures. Domain suites own
argument semantics; `checks.test.mjs` owns common help/unknown-option checks.
Browser domain suites call task entries directly. Doctor and dispatch
are tested separately with matching, mismatched and missing source-site fixtures.
It also owns shared HTML extraction, date-row ordering and static page-control
faults. Site-specific article samples and copy stay in consumer tests.

Run source-domain scripts separately. Navigation state checks also need Chromium:

```text
swban base/node tests/csp/build.mjs              #Inline hashes and minification
swban base/node tests/prefetch/build.mjs         #Rules, config variants and CSP
swban base/node tests/prefetch/policy.mjs        #Prefetch decisions
swban base/node tests/nav/state.mjs              #Navigation, selection and sorting
swban base/node tests/nav/rebuild.mjs            #Incremental ancestor-title rebuilds
swban base/node tests/collections/build.mjs      #Content overlays and list models
swban base/node tests/palette/build.mjs          #Palette overrides and contrast
swban base/node tests/output/budget.mjs <build>  #Repository output budgets
```

Use `base/bun` to check these scripts with Bun. JS fixtures use Hugo `js.Build` with native
asset files and source maps. Collections and palette scripts use the prepared
Skill browsers. Package dependencies stay inside the Skill; the repository
root needs no npm package or Playwright installation.

`output/budget.mjs` reads an existing minified build. Its fixed thresholds are
repository policy; installed Skill checks validate contracts and reports measure
consumer output. `output/retired.mjs` is imported by build/UI tests.

Browser coverage and page requirements are in the Skill's
[browser guide](../.agents/skills/swaw-banyan/references/browser-site.md).
Consumer sites keep business copy, accounts, branding and actual-path journeys
in their own tests; they reuse the Skill checks and suite runner.
