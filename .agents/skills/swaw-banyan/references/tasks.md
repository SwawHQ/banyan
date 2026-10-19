# Task maintenance

Read this when adding tasks or composing a site's tests. For command discovery
and arguments, use `swban help 1` and `swban help <path>`.

## Place code by responsibility

- Commands map to `tasks/<command>/entry.mjs`. Directories without an entry are
  not commands; underscore prefixes identify supporting code.
- Keep argument handling in the entry and inspection in its domain leaf.
  Checks return issues; reports return measurements. A report may reuse a
  parser without importing a CLI entry.
- Put code used by one task in that task. Put shared mechanics in the
  nearest owning group's `_shared/`; reserve `tasks/_shared/` for code used
  across groups. Keep behavioral assertions in the owning leaf.
  Avoid shared functions that dispatch by task name.
  Shared methods used only by delivery checks stay in `check/delivery/_shared/`.
  Keep platform parsing, policy comparison and file inspection in their own
  `check/delivery/` subdirectories; they are not separate commands.
- Generic checks belong in the Skill. Theme source tests and fixed demo
  fixtures belong in the Banyan repository's `tests/`. Business expectations
  and site-specific routes belong in the consuming site's tests.
- Platform tasks live in `deploy/<platform>/`. Config sync consumes generated
  files. Publication tasks should consume completed output.

Base tools use `base/<tool>`, `base/<tool>/check` and `base/<tool>/ensure`.
The CLI runs with Node and prepares Node/npm when executing a task.
Node package managers use `base/node/npm` and `base/node/npx`.
Bun remains an independent tool through `base/bun`, `base/bun/check` and
`base/bun/ensure`; it does not select the CLI runtime.
Domain code uses `prepareTools` for missing tools; Hugo callers use
`prepareHugo`, which prepares Git, Go and Hugo.
Existing bindings stay selected. Python uses `base/uv/python` and a Skill-owned
environment; Python CLI packages use `base/uv tool run`. See [Python tools](python.md).
JSON task help, doctor and tool status checks do not prepare tools. Native help runs the tool.
`help`, `help/en` and `help/zh` are separate tasks. `tasks/_cli/` owns
dispatch and JS bootstrap. `bootstrap/windows.ps1` handles Windows cold start.
Reusable tool APIs stay in ordinary modules, not CLI entries.

Doctor checks selected tools and Banyan pairing. Ordinary tasks do not run
pairing checks. Check switches and translated repair hints live in
references/doctor.toml; check implementations stay in tasks/doctor/.
Doctor reports problems without installing or repairing tools or packages.

Core YAML and TOML packages use the Skill root's `package.json`,
`package-lock.json` and ignored `node_modules/`. `sync/ext` and content checks
prepare them when needed; `base/packages/ensure [--force]` prepares them explicitly.
Help does not install packages. Doctor reports missing core packages before
loading its TOML configuration. Each dependency group keeps one
`package-lock.json`; the shared installer runs npm with Node and disables
parent workspaces. Keep optional feature packages in their owning group.
Cloudflare CLI packages belong to `deploy/cloudflare/cli/` and
`deploy/cloudflare/wrangler/`. Their entries prepare locked packages on demand;
their `check` commands inspect local installation without authentication.
See [Cloudflare tools](cloudflare.md).
Tencent Cloud's `deploy/tencent/cli` uses uv's isolated tool environment and
pins its package in the leaf's `requirements.txt`; its `check` reads local files
without running package code. See [Tencent Cloud tools](tencent.md).

## Preserve the existing contracts

Hugo resolves configuration, modules and content mounts. Do not reproduce its
inheritance or module resolver. `doctor` reads release metadata from
`SKILL.md`; tool compatibility and download definitions live in `tools.json`.

Argument declarations stay in `tasks/check/browser/_shared/options.mjs` and
each leaf's `options.mjs`. Use `browserCommand` and `parseArguments` for
validation. Help must work before opening a site, loading tools or starting
a browser.

Browser assertions live in the leaf's `check.mjs`. The shared runner owns
browser/context lifecycle, reports and cleanup. The local server applies the
build's generated `_headers`. Ordinary UI checks block service workers;
checks that need worker transport select it explicitly.

Unsuffixed browser commands use Chromium. Add WebKit coverage for an actual
engine-sensitive requirement. Each `.webkit` entry explicitly selects WebKit
and reuses the check; the dispatcher does not interpret the suffix.
Browser checks share mechanics in `check/browser/_shared/`. Runtime and
Playwright dependencies stay in `tasks/_shared/browser/` for both preparation
and checks. Only `base/browser/ensure` and `base/browser/ensure.webkit` install browser
dependencies.
Checks do not install or switch engines.

## Maintain help

Place a `help.json` beside every command entry and in every ancestor category.
An entry makes a command executable; a help file does not create a command.
Keep `en` and `zh` objects with `summary`, `usage` and `details` fields.
`summary` is the one-line list description. `usage` is the invocation line.
`details` is an array of lines for the full help. Keep validation in code.

`help [depth|path [depth]]` uses the system language. `help/en` and `help/zh` select
the language. With no argument, show the common commands from the help task's
`tasks/help/help.json`, beside its `entry.mjs`. Its `en.details` and `zh.details`
supply the shared home page for all three help commands. Keep each command and
description on one line, with `#` markers aligned within each group.
Topic guides stay in `references/`.

A depth lists commands and categories, including all shallower levels.
A path followed by a depth lists descendants below that path, keeping full
paths. Depth starts below the selected path: `help check 2` includes
`check/http/cache`; `help check/browser 3` lists three levels below `check/browser`.
A path displays full help; categories also list their direct children.
Only directories with an entry, and their ancestors, appear in these lists.
Category paths end in `/`; executable commands have no suffix, including
commands with children. Help queries accept a trailing `/` in a path.

Help reads JSON without importing task entries. Ordinary task `--help` reads
the same file through `helpFor`. Native tools keep their own help flags.
Update help when changing arguments, defaults or examples. The Windows cold
reader and JS reader use the same files and have output-parity tests.

## Compose a site suite

Static site checks can import `inspectDocumentMetadata` from
`check/html/metadata/document.mjs` and `inspectDocumentControls` from
`check/html/scripts/controls.mjs`. Both accept HTML and return issues.

Import `runScenarioSuite` from `tasks/check/browser/_shared/suite.mjs` through a
site-owned entry, run with `swban base/node`. Supply scenarios,
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
