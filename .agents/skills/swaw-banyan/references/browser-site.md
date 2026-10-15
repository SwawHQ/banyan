# Browser checks

Read this when selecting browser coverage. Use a task's `--help` for its full
parameters, defaults and examples.

## Prepare and choose coverage

Run `swban ensure/browser` for Chromium. Prepare `ensure/browser.webkit` only
for a selected WebKit check. Dependencies stay in the Skill's
`tasks/_shared/browser/node_modules`; browser binaries stay in `.tools/browser`.
Both are ignored by Git. A Node runtime needs npm for browser preparation;
if it has none, use `swban node.ensure --force` for the portable Node package.

Checks serve a completed build locally with its generated `_headers`, then
inspect it in an isolated browser context. They do not inspect a running Hugo
server. Use HTTP tasks for actual deployed responses.

Start with representative site coverage below. Add targeted checks for changed
features; `.webkit` commands provide selected WebKit coverage. Use `--headed`
to observe a run, `--out` to retain a report, and `--trace` for a trace.
Requested reports/traces are retained; temporary builds are cleaned up.

## Representative site coverage

```text
swban check/browser/site ./public
swban check/browser/site ./public --updates
swban check/browser/site ./preview --updates --site ./site-source
swban check/browser/site ./preview --trace --out ./browser-report
swban check/browser/site --help
```

Prepare Chromium with `ensure/browser`. The command samples published HTML by
feature markers, language and native links. It checks the home, CSP, prose,
contrast, a sortable collection, speculation rules, runtime coordination,
diagnostics and SW offline behavior where suitable pages exist. Selected paths
and skipped coverage appear in the report. It does not run every browser task
or assert site copy, accounts, branding or every language/page combination.
Palette roles remain separate because custom fixed surfaces can be valid.

Ordinary checks share the supplied build and one static server. They do not
invoke Hugo. `--updates` requires an enabled SW and a versioned update panel
with reciprocal native root links. It checks manual updates, native navigation
and browser activation after old controlled pages close.

The command uses the selected Hugo, Go and Git to produce a temporary next
production build. It reads the source site's normal config, changes the build
version through the child environment, and adds a harmless SW revision probe
comment to the temporary output. Content-only releases keep `sw.js` unchanged;
the probe lets these checks exercise waiting-worker activation. Output, cache
and resources are isolated. Source defaults to the caller's current directory; use `--site` for
another source. Source and published build must use the same site/config.
Generated files are removed after execution. Existing builds and content are
preserved. To test two actual code states, pass explicit builds to the leaf
PWA commands instead. SW disable uses `check/browser/pwa/disable` separately.

Reports always use a new directory: the system temporary directory by default,
or beneath `--out`. JSON includes discovery, browser/version, results and skipped
reasons. Failures retain screenshots; `--trace` records each executed case.
A failed case returns a nonzero exit code and later cases still run.

This entry uses Chromium and production files with generated `_headers`.
Use targeted `.webkit` tasks for engine-sensitive work, HTTP tasks for deployed
responses, and consumer-owned suites for business expectations.

## Targeted checks: select suitable pages

Paths below are task suffixes under `check/browser/`. Pass routes from the
actual site; default example routes may not exist in a customized site.

| Task family | Page or build requirements |
| --- | --- |
| `palette/contrast`, `palette/roles`, `prose/layout` | A page with visible `.prose`. Custom fixed palettes can use contrast without derived-role checks. |
| `appearance` | Appearance settings and a source page linking to them. |
| `nav/sort` | A sortable collection with distinct names in a group and an article carrying source context. |
| `nav/anchors`, `nav/keyboard` | A scrollable article for anchors; a tabbable control after root navigation for keyboard checks. |
| `nav/tabs`, `nav/roots`, `img/load` | Actual `_blank` links, linked root pages or matching images respectively. Tab destinations are served locally, not checked as external services. |
| `breadcrumb/*` | Existing path columns. Sort needs distinct sortable values; isolation needs two sortable areas; source needs a linked article; header should include a long label. |
| `collection/layout`, `collection/style` | A nonempty collection; style also needs an article with selected and unselected path rows. |
| `language/choices`, `language/return` | Translated settings for declared languages. Use a translated source for normal return and an untranslated source for the missing-translation case. |
| `language/bfcache` | A source translated into both requested targets, plus translated settings. The check requires actual BFCache restoration. |
| `settings/history` | A source page and an ordered settings-page chain. |
| `aside/*` | An article with an aside; chapters needs at least two h2/h3 headings and scrolling; print needs metadata. |
| `canvas/history`, `canvas/touch` | Two scrollable articles; history needs sorting on the second, touch needs an aside on the source. |
| `canvas/open` | A collection and a long article linked from it. Chromium `--drag` requires touch mode and a distance that reveals the article link. |
| `canvas/first-paint` | Article, collection or settings pages; include source/sort URLs when testing reserved columns. |
| `prefetch/rules`, `prefetch/overlap`, `prefetch/debug` | Match inline rules to each page; overlap requires automatic native selection and candidates. Debug checks its five backend choices and published state. |
| `pwa/panel` | Two pages with reciprocal root links. This tests panel UI with workers blocked, not real updates. |
| `pwa/offline` | An SW-enabled build. The first visit only registers; a later controlled navigation supplies the HTML and resources for offline reload. |

## Explicit SW build pairs

For `pwa/check`, `lifecycle`, `native` and `language`,
supply an initial build and `--next` with a second SW-enabled build whose
`sw.js` bytes differ. The server switches files and headers at the same origin.
Most update tasks need reciprocal links between the chosen page and source;
language needs the actual target-language link. Use `--help` for each task.

Use `check/browser/site --updates` for a temporary program-update probe without
editing content. To test two actual code states, build those states separately.

`pwa/disable` needs an enabled build followed by one with
`service_worker.mode = "disable"`. `off` does not perform cleanup.
Disable prefetch in the second build when checking SW removal without prefetch hints.

For `pwa/content`, supply two builds with identical `sw.js` bytes and different
`sw-version.json` versions. The check covers the real 15-second delay, concurrent
navigation, cache replacement, fingerprint reuse and preserved readers. Content
checks continue while a program waits for activation. Use `--page` for the build-version panel and `--from`
for a second cached page. The check advances only the worker's clock to cross the
minimum check interval; it does not change the configured interval.
