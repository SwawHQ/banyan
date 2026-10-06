# Banyan Scripts

This directory is split by script side effect, not by implementation detail.

- `build/`: post-build scripts that may mutate generated output or deployment config. These are production-path scripts and are intentionally invoked by `bun run build`.
- `checks/`: checks and reports. They do not mutate production output; contract checks may create isolated fixtures and reports under the consuming site's ignored `temp_workspace/`.
- `browser-regression/`: the shared browser runner, static server, helpers, and generic theme contracts.
- `dev/`: local developer helpers for browser-test builds and command guidance. The consuming site's adapter owns the development server.
- `adapters/`: opt-in deployment or hosting adapters.
- `external-resources/`: explicit data-preparation scripts that sync declared remote files into the consuming site.

Most scripts treat `process.cwd()` as the consuming site root. This keeps the
same script usable from the root demo or another Banyan consumer. Repository
tools currently live in `scripts/`; the local theme implementation lives in
`module/`. Package commands are invoked from the repository root.

Consumer-specific browser journeys belong in the site's `scripts/browser-regression/`.
The site imports generic theme scenarios and passes its combined suite explicitly
to `runBrowserRegression({ scenarios })`. Brand, legal information, navigation
copy, real article paths, and screenshots of site content are owned by the site.
Theme checks use synthetic data for such inputs; image delivery checks derive
the site's origin from the published home page's canonical URL.

EdgeOne-specific scripts live under `adapters/edgeone/`. They are provided by
the theme because Banyan can emit EdgeOne config, but they remain opt-in and
should be called explicitly from a site's `package.json`.

When adding a script, choose the directory by what it does to the workspace. If
it mutates generated output such as `public/`, it belongs in `build/`. If it
adapts Banyan output to a specific hosting platform, it belongs in `adapters/`.
