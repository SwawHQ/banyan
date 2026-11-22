# Task maintenance

Read this when adding commands or composing site tests. Use `swban help 1` and
`swban help <path>` to discover existing commands before adding one.

## Place code by responsibility

- A command lives at `tasks/<command>/entry.mjs`. Put argument handling there
  and domain work in nearby modules. Checks return issues; reports return measurements.
- Keep code used by one task with that task. Share mechanics in the nearest
  owning group's `_shared/`; use `tasks/_shared/` only across groups. Keep tests
  with the code they exercise. Avoid shared helpers that dispatch by task name.
- Generic checks belong in the Skill. Theme source tests and fixed reference-site
  fixtures belong in the repository's `tests/`. Business assertions belong in
  the consuming site's tests.
- Generated platform configuration belongs in `deploy/<platform>/`. Cloud CLI
  preparation, authorization and upload belong to the separate Swaw Clouds Skill.

## Reuse tool preparation

Use `prepareTools` for missing tools and `prepareHugo` for Hugo, Go and Git.
Preserve selected bindings. Let Hugo resolve configuration, modules and content
mounts; do not reproduce its resolver or inheritance rules.

| Responsibility | Owner |
| --- | --- |
| Windows cold start | `platform/windows/bootstrap.ps1` |
| Linux / macOS cold start | `platform/linux/bootstrap.sh`, `platform/mac/bootstrap.sh` |
| Shared shell, help and archive handling | `platform/posix/` |
| Dispatch and JS bootstrap | `tasks/_cli/` |
| Tool commands | `base/<tool>`, `base/<tool>/check`, `base/<tool>/ensure` |
| Node package managers | `base/node/npm`, `base/node/npx` |
| Theme release metadata | `SKILL.md` |
| Tool compatibility and downloads | `tools.<os>-<arch>.json` |
| Doctor switches and translated repair hints | `references/doctor.toml` |
| Doctor implementation | `tasks/doctor/` |

The CLI uses Node; Bun is an independent tool, not a CLI runtime selector.
macOS x64 and ARM64 share `platform/mac/` code. Their manifests, cold-start data
and installation receipt platform IDs are separate; do not share `.tools/` between architectures.
Text help, doctor and tool status checks do not prepare tools. Native help runs
its tool. Doctor reports pairing and dependency problems without repairing them;
ordinary tasks do not run pairing checks.

Core YAML/TOML packages use the Skill root's package manifest, lockfile and ignored
`node_modules/`. `sync/ext` and content checks prepare them on demand;
`base/packages/ensure` prepares them explicitly. Doctor reports missing packages
before reading its TOML configuration. Keep optional packages in their owning
group, with one lockfile per group. Reuse the installer that runs npm through
Node with parent workspaces disabled.

## Add browser checks

Use `browserCommand` from `tasks/check/browser/_shared/options.mjs` and
`parseArguments` from `tasks/_shared/arguments.mjs`. Keep leaf arguments in
`options.mjs` and assertions in `check.mjs`. Help must work before reading a
site, preparing tools or starting a browser.

The shared runner owns browser/context lifecycle, reports and cleanup. Its
server applies the build's `_headers`. Ordinary UI checks block service workers;
checks requiring worker transport select it explicitly.

Unsuffixed commands use Chromium. Add `.webkit` only for a real engine-sensitive
requirement; its entry explicitly selects WebKit and reuses the check. The
dispatcher does not interpret suffixes. Both engines use the runtime and packages
in `tasks/_shared/browser/`. Only `base/browser/ensure` and
`base/browser/ensure.webkit` install browser dependencies; checks do not install
or switch engines. Page requirements are in [Browser checks](browser-site.md).

## Maintain help

Place `help.en.txt` and `help.zh.txt` beside each command entry and in every
ancestor category. The first line is `usage  #summary` (two spaces before `#`).
The remaining lines are displayed unchanged. Use UTF-8 without BOM and LF endings.
Keep validation in code, and align command descriptions within each group.

An entry creates an executable command; help files alone do not. For a help-only
topic, use `tasks/<topic>/help.<language>.txt` with usage `swban help <topic>`.
Topics are available by explicit path and excluded from command lists.
Detailed Agent guidance belongs in `references/`.

JS, Windows cold help and POSIX cold help read these same files without importing
task entries. Update the files with argument or default changes. Keep all readers
in parity through the help tests. Use `swban <command>/help` for task help.
Argument errors point to the invoked task's help. Native tools receive their own help arguments.

After changing a Linux or macOS Node definition, run
`node platform/posix/bootstrap-data.mjs linux x64`,
`node platform/posix/bootstrap-data.mjs mac x64` or `node platform/posix/bootstrap-data.mjs mac arm64` from the Skill directory. Its generated
`node-<arch>.txt` supplies only the data needed before Node can read JSON. The tests
check that it matches the platform manifest. Help text has no generated copy.

## Compose a site suite

For static HTML, reuse `inspectDocumentMetadata` from
`tasks/check/html/metadata/document.mjs` and `inspectDocumentControls` from
`tasks/check/html/scripts/controls.mjs`. Both accept HTML and return issues.

For browser scenarios, import `runScenarioSuite` from
`tasks/check/browser/_shared/suite.mjs` through a site-owned entry run with
`swban base/node`. Supply scenarios, the build and a report directory; update
scenarios also need a build pair. Keep site paths, build selection and business
assertions in that entry or its domain modules.

The suite reuses prepared browsers and the server, isolates each scenario's
context, and records engine/version, failures and timeouts. A scenario may supply
`launchOptions`, for example for BFCache. Read the existing suite API and source
examples when implementing it. `check/browser/site` composes existing checks;
add assertions to their owning leaf rather than duplicating them in discovery.

## Validate changes

Test meaningful successful and failing cases. Dispatch changes also need stream,
exit-status and help-without-tools coverage. Checks must not change site source
or tool bindings. Fixtures use isolated system temporary directories and clean
up on success or failure.

JS fixtures can use `tasks/_shared/hugo-js.mjs` for Hugo js.Build and source maps;
callers own their temporary directories. The repository's `tests/README.md`
lists source suites but is not needed to use an installed Skill.

After editing or moving installation examples, run the repository's
`tests/install.test.mjs`. It builds consumer sites from those examples.
