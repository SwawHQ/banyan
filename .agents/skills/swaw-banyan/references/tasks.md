# Task maintenance

Read this when adding tasks or composing a site's tests. For command discovery
and arguments, use `swban help` and the selected task's `--help`.

## Place code by responsibility

- Commands map to `tasks/<command>/entry.mjs`. Directories without an entry are
  not commands; underscore prefixes identify supporting code.
- Keep argument handling in the entry and inspection in its domain leaf.
  Checks return issues; reports return measurements. A report may reuse a
  parser without importing a CLI entry.
- Put reusable mechanics in `_shared/`; keep behavioral assertions in the
  owning leaf. Avoid shared functions that dispatch by task name.
- Generic checks belong in the Skill. Theme source tests and fixed demo
  fixtures belong in the Banyan repository's `tests/`. Business expectations
  and site-specific routes belong in the consuming site's tests.
- Platform tasks live in `deploy/<platform>/`. Config sync consumes generated
  files. Publication tasks should consume completed output.

## Preserve the existing contracts

Hugo resolves configuration, modules and content mounts. Do not reproduce its
inheritance or module resolver. `check/module` reads release metadata from
`SKILL.md`; tool compatibility and download definitions live in `toolchain.json`.

Arguments and detailed browser help share declarations in
`tasks/_shared/browser/options.mjs` and each leaf's `options.mjs`. Use
`browserCommand` and `parseArguments`; help must work before opening a site,
loading tools or starting a browser.

Browser assertions live in the leaf's `check.mjs`. The shared runner owns
browser/context lifecycle, reports and cleanup. The local server applies the
build's generated `_headers`. Ordinary UI checks block service workers;
checks that need worker transport select it explicitly.

Unsuffixed browser commands use Chromium. Add WebKit coverage for an actual
engine-sensitive requirement. Each `.webkit` entry explicitly selects WebKit
and reuses the check; the dispatcher does not interpret the suffix.
Only `ensure/browser` and `ensure/browser.webkit` install browser dependencies.
Checks do not install or switch engines.

## Compose a site suite

Static site checks can import `inspectDocumentMetadata` from
`check/html/metadata/document.mjs` and `inspectDocumentControls` from
`check/html/scripts/controls.mjs`. Both accept HTML and return issues.

Import `runScenarioSuite` from `tasks/_shared/browser/suite.mjs` through a
site-owned entry, run with `swban bun` or `swban node`. Supply scenarios,
the published build and a report directory. Upgrade scenarios also need a
build pair. Site paths, build selection and business assertions stay in that
entry or its domain modules.

The suite reuses prepared browsers and the shared server, creates an isolated
context per scenario, and records engine/version, failures and timeouts.
A scenario may supply `launchOptions` for a specific requirement such as
BFCache. Use the existing suite API and source examples when implementing it.

`check/browser/site` discovers representative pages and composes existing
checks. Add assertions to the owning leaf instead of duplicating them in the
discovery command.

## Validate changes

Keep help independent of tools and input files. Test meaningful successful
cases and faults, plus stream/exit behavior when changing dispatch. Fixtures
use isolated system temporary directories and clean up on success or failure.
Do not change the site's source or tool bindings as part of a check.

Source JS fixtures can use `tasks/_shared/hugo-js.mjs` for Hugo js.Build and
source maps. Callers own their temporary directories. See the repository's
`tests/README.md` for source suites; it is not required to use the installed Skill.
