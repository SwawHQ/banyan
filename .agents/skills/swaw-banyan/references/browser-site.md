# Browser checks

Read this when selecting browser coverage. Use each task's `--help` for arguments.

## Prepare and run

Prepare Chromium with `swban base/browser/ensure`. For a selected WebKit check,
use `swban base/browser/ensure.webkit`. If Node has no npm, use
`swban base/node/ensure --force` to prepare the portable Node package.

Checks serve a completed build locally and apply its generated `_headers`.
They do not inspect a running Hugo server or simulate EdgeOne headers. Without
`_headers`, site coverage skips HTTP CSP. Use HTTP tasks for deployed responses.

```text
swban check/browser/site ./public                                  #Check representative pages
swban check/browser/site ./public --updates                        #Also test a temporary SW update
swban check/browser/site ./preview --updates --site ./site-source  #Use another source directory
swban check/browser/site ./preview --trace --out ./browser-report  #Keep traces and reports
```

## Representative site coverage

`check/browser/site` uses Chromium and samples published HTML by feature markers,
language and native links. It covers the home, CSP, prose, contrast, sorting,
speculation rules, runtime coordination, diagnostics and offline behavior where
suitable pages exist. The report identifies selected pages and skipped coverage.
This is representative coverage, not every task or every page/language combination.
Use targeted `.webkit` checks for engine differences and site-owned suites for
copy, accounts, branding and business expectations. Derived palette-role checks
remain separate because custom fixed surfaces can be valid.

Ordinary checks reuse the supplied build without invoking Hugo. `--updates`
requires an enabled SW and a versioned update panel with reciprocal native root
links. It builds a temporary next version using the source site's normal config
and selected Hugo, Go and Git. Source defaults to the current directory; `--site`
selects another source. The source and supplied build must use the same site/config.

The temporary build changes the content version and adds a comment to `sw.js`
to exercise waiting-worker activation, including activation after old controlled
pages close. It does not represent an actual source-code release. Output, cache
and resources are isolated and cleaned up; source and supplied builds are preserved.
For two actual code states or SW removal, use the explicit build pairs below.

Reports use a new directory under `--out`, or the system temporary directory
by default. They include discovery, engine/version, results and skipped reasons.
Failures retain screenshots; `--trace` records each executed case. A failed case
returns a nonzero exit code, but later cases still run.

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
| `breadcrumb/*` | Existing breadcrumb columns. Sort needs distinct sortable values; isolation needs two sortable areas; source needs a linked article; header should include a long label. |
| `collection/layout`, `collection/style` | A nonempty collection; style also needs an article with selected and unselected path rows. |
| `language/choices`, `language/return` | Translated settings for declared languages. Use a translated source for normal return and an untranslated source for the missing-translation case. |
| `language/bfcache` | A source translated into both requested targets, plus translated settings. The check requires actual BFCache restoration. |
| `settings/history` | A source page and an ordered settings-page chain. |
| `aside/*` | An article with an aside; chapters needs at least two h2/h3 headings and scrolling; print needs metadata. |
| `canvas/history`, `canvas/touch` | Two scrollable articles; history needs sorting on the second, touch needs an aside on the source. |
| `canvas/open` | A collection and a long article linked from it. Chromium `--drag` requires touch mode and a distance that reveals the article link. |
| `canvas/first-paint` | Article, collection or settings pages; include source/sort URLs when testing reserved columns. |
| `canvas/wheel` | Horizontal wheel and keyboard input. A long article with metadata and overflowing code/table samples; `--short` needs a short article with a local prose link. |
| `prefetch/rules`, `prefetch/overlap`, `prefetch/debug` | Match inline rules to each page; overlap requires automatic native selection and candidates. Debug checks its five backend choices and published state. |
| `pwa/panel` | Two pages with reciprocal root links. This tests panel UI with workers blocked, not real updates. |
| `pwa/offline` | An SW-enabled build. The first visit only registers; a later controlled navigation supplies the HTML and resources for offline reload. |

## Explicit SW build pairs

Pass two completed builds; the server switches files and headers at the same origin.
Use each task's `--help` to select the actual page routes.

| Task under `check/browser/` | Required pair |
| --- | --- |
| `pwa/check`, `pwa/lifecycle`, `pwa/native`, `pwa/language` | Two SW-enabled builds with different `sw.js` bytes; pass the second as `--next`. Most need reciprocal page/source links; language checks need the actual target-language link. |
| `pwa/disable` | An enabled build followed by `sw.mode = "disable"`. `off` leaves workers installed. Disable prefetch in the second build when checking removal without prefetch hints. |
| `pwa/content` | Identical `sw.js` bytes and different `sw-version.json` versions. Use `--page` for the version panel and `--from` for a second cached page. |

Content checks cover concurrent navigation, independent version requests, cache
replacement, fingerprint reuse and preserved readers. They also check content
updates while a program waits for activation and respect for the configured interval.
