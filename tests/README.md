# Source tests

Run from the Banyan repository root with the installed Skill's `swban.cmd`.
Prepare Hugo, Go and Git first. Browser suites also need the Skill's Chromium
and WebKit. Tests use system temporary directories and remove their fixtures;
Hugo caches and resources stay there. They do not change site content or Git state.

Root suites support Bun and Node, except `toolchain.test.mjs`.
Select the files explicitly in PowerShell:

```powershell
$taskTests = Get-ChildItem ./tests -Filter '*.test.mjs' -File | Where-Object Name -ne 'toolchain.test.mjs'
.\.agents\skills\swaw-banyan\swban.cmd base/bun test $taskTests.FullName --timeout 60000
.\.agents\skills\swaw-banyan\swban.cmd base/node --test $taskTests.FullName
.\tests\toolchain.ps1
```

Run `toolchain.ps1` with Windows PowerShell 5.1. It compiles a native fixture
and runs the installer tests with portable Bun and a system Node.
Toolchain fixtures do not log in or publish.

Generic help, doctor, theme resolution, delivery, fingerprint and asset-report tests ship with the Skill:

```powershell
$skillTests = Get-ChildItem @('./.agents/skills/swaw-banyan/tasks/check/delivery/_tests','./.agents/skills/swaw-banyan/tasks/doctor/_tests','./.agents/skills/swaw-banyan/tasks/help/_tests','./.agents/skills/swaw-banyan/tasks/report/size/assets/_tests') -Filter '*.test.mjs' -File
.\.agents\skills\swaw-banyan\swban.cmd base/node --test $skillTests.FullName
```

| Suite | Responsibility |
| --- | --- |
| `module.test.mjs`, `js-build.test.mjs` | Module/theme pairing, Hugo resolution and JS build inputs |
| `install.test.mjs` | Documented starter, isolated Module/Skill packages and site overrides |
| `cache-policy.test.mjs` | Delivery configuration, platform output, worker matching, versioned caching and controlled-navigation warmup |
| `tasks.test.mjs`, `checks.test.mjs` | Dispatch, streams, sync faults, help, arguments and static/HTTP checks |
| `browser.test.mjs`, `browser-site.test.mjs` | Engines, CSP, discovery, reports, isolation and cleanup |
| `browser-{aside,breadcrumb,canvas,collection,nav,opening,presentation}.test.mjs` | Navigation, geometry, native input and first paint |
| `browser-{language,settings,ui}.test.mjs` | Translation, history, preferences and palette |
| `browser-{pwa,offline-update,content,update,disable,prefetch}.test.mjs` | Registration, native worker activation, controlled offline navigation, content versions, cache ownership and prefetch |
| `output.test.mjs` | Repository budgets and retired-output faults |
| `sitemap.test.mjs` | Rendered HTML discovery, native exclusions, translations and rebuilds |
| `documentation.test.mjs` | Official documentation routes, links, language indexes and discovery URLs |

Each suite keeps its successful cases and fault fixtures. Domain suites own
argument semantics; `checks.test.mjs` owns common help/unknown-option checks.
Browser domain suites call task entries directly. Doctor and dispatch
are tested separately with matching, mismatched and missing source-site fixtures.
It also owns shared HTML extraction, date-row ordering and static page-control
faults. Site-specific article samples and copy stay in consumer tests.

Run source-domain scripts separately:

```text
swban base/bun tests/csp/build.mjs              #Inline hashes and minification
swban base/bun tests/prefetch/build.mjs         #Rules, config variants and CSP
swban base/bun tests/prefetch/policy.mjs        #Prefetch decisions
swban base/bun tests/nav/state.mjs              #Navigation, selection and sorting
swban base/bun tests/nav/rebuild.mjs            #Incremental ancestor-title rebuilds
swban base/bun tests/collections/build.mjs      #Content overlays and list models
swban base/bun tests/palette/build.mjs          #Palette overrides and contrast
swban base/bun tests/output/budget.mjs <build>  #Repository output budgets
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
