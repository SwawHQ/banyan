# Source tests

Run from the Banyan repository root with the installed Skill's `swban.cmd`.
Prepare Hugo, Go and Git first. Browser suites also need the Skill's Chromium
and WebKit. Tests use system temporary directories and remove their fixtures;
Hugo caches and resources stay there. They do not change site content or Git state.

Root suites support Bun and Node, except `toolchain.test.mjs`.
Select the files explicitly in PowerShell:

```powershell
$taskTests = Get-ChildItem ./tests -Filter '*.test.mjs' -File | Where-Object Name -ne 'toolchain.test.mjs'
.\.agents\skills\swaw-banyan\swban.cmd bun test $taskTests.FullName --timeout 60000
.\.agents\skills\swaw-banyan\swban.cmd node --test $taskTests.FullName
.\tests\toolchain.ps1
```

Run `toolchain.ps1` with Windows PowerShell 5.1. It compiles a native fixture
and runs the installer tests with portable Bun and a system Node.
Toolchain fixtures do not log in or publish.

| Suite | Responsibility |
| --- | --- |
| `module.test.mjs`, `js-build.test.mjs` | Module pairing, Hugo resolution and JS build inputs |
| `install.test.mjs` | Documented starter, isolated Module/Skill packages and site overrides |
| `cache-policy.test.mjs` | Delivery configuration, platform output, worker matching, bucket caching and warmup |
| `tasks.test.mjs`, `checks.test.mjs` | Dispatch, streams, sync faults, help, arguments and static/HTTP checks |
| `browser.test.mjs`, `browser-site.test.mjs` | Engines, CSP, discovery, reports, isolation and cleanup |
| `browser-{aside,breadcrumb,canvas,collection,nav,opening,presentation}.test.mjs` | Navigation, geometry, native input and first paint |
| `browser-{language,settings,ui}.test.mjs` | Translation, history, preferences and palette |
| `browser-{pwa,update,disable,prefetch}.test.mjs` | Worker lifecycle, cache ownership and prefetch |
| `output.test.mjs` | Repository budgets and retired-output faults |
| `sitemap.test.mjs` | Rendered HTML discovery, native exclusions, translations and rebuilds |
| `documentation.test.mjs` | Official documentation routes, links, language indexes and discovery URLs |

Each suite keeps its successful cases and fault fixtures. Domain suites own
argument semantics; `checks.test.mjs` owns common help/unknown-option checks.
It also owns shared HTML extraction, date-row ordering and static page-control
faults. Site-specific article samples and copy stay in consumer tests.

Run source-domain scripts separately:

```text
swban bun tests/csp/build.mjs              #Inline hashes and minification
swban bun tests/prefetch/build.mjs         #Rules, config variants and CSP
swban bun tests/prefetch/policy.mjs        #Prefetch decisions
swban bun tests/nav/state.mjs              #Navigation, selection and sorting
swban bun tests/nav/rebuild.mjs            #Incremental ancestor-title rebuilds
swban bun tests/collections/build.mjs      #Content overlays and list models
swban bun tests/palette/build.mjs          #Palette overrides and contrast
swban bun tests/output/budget.mjs <build>  #Repository output budgets
```

These scripts also support Node. JS fixtures use Hugo `js.Build` with native
asset files and source maps. Collections and palette scripts use the prepared
Skill browsers. No source suite needs a root npm package or root Playwright.

`output/budget.mjs` reads an existing minified build. Its fixed thresholds are
repository policy; installed Skill checks validate contracts and reports measure
consumer output. `output/retired.mjs` is imported by build/UI tests.

Browser coverage and page requirements are in the Skill's
[browser guide](../.agents/skills/swaw-banyan/references/browser-site.md).
Consumer sites keep business copy, accounts, branding and actual-path journeys
in their own tests; they reuse the Skill checks and suite runner.
