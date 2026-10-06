# Banyan for Hugo

A minimalist, multi-language Hugo theme, with a runnable demo in the repository root.

## Run the Demo

Install Git, Go 1.18 or newer, and Node.js 18.17 or newer. Then:

```bash
git clone https://github.com/SwawHQ/banyan.git
cd banyan
npm install
npm run dev
```

## Setup (Crucial Step)

Due to Hugo's configuration merging rules, structural configurations like
`[outputs]`, `[taxonomies]`, and `[permalinks]` **must** be defined in your
site's root configuration file. Banyan provides its custom `[outputFormats]`,
but the root site still needs `[outputs]` entries to enable them.

The repository's root `hugo.toml` is the starter configuration. The demo consumes
`github.com/SwawHQ/banyan/module` through Hugo Modules; its root `go.mod` replaces
that dependency with `./module` for local development. No module release is
needed to build the demo or preview changes.

Customize root content, `baseURL`, `title`, language settings, and deployment
params to build your own site. Site files override corresponding module files.
The published theme module contains only `module/`; demo content and repository
tools are outside that module.

Set the shared site description in your root `hugo.toml`:

```toml
[params]
description = "Your site description."
```

For localized copy, override `languages.<lang>.params.description`. Pages may
define their own front matter `description`; otherwise SEO and social cards use
the site description. `llms.txt` also uses the site description for its intro
and home entry. The former `content/fragments/site-meta/` container is removed;
move its values into site params and delete the old files.

Keep each language's social locale in `languages.<lang>.params.locale`; Banyan
uses it for Open Graph locale tags.
An optional `languages.<lang>.params.icon = { text = "EN" }` supplies the short marker shown
by the language choice list; when absent, Banyan uses its language icon.

If you need to customize cache routes, SW cache behavior, or deployment metadata,
create a site-owned `data/cache-policy.toml`. Banyan falls back to
`module/data/cache-policy-default.toml` when that file is absent in this repository.

```bash
mkdir -p data
# create data/cache-policy.toml only when your site needs route overrides
```

Keep site-owned URL migrations separate from cache policy in
`data/redirects.toml`. Provider-specific renderers consume these neutral rules
and generate EdgeOne `edgeone.json` entries and Cloudflare Pages `_redirects`:

```toml
[[rules]]
source = "/old-path/"
destination = "/new-path/"
status = 301
```

## Repository Layout and Local Development

The root demo is a consumer of the local theme module:

```text
banyan/
├── hugo.toml, go.mod, package.json   # Demo configuration and commands
├── content/, data/                 # Demo content and site-owned data
├── module/                         # Published Hugo Module and defaults
│   ├── go.mod, hugo.toml
│   └── layouts/, assets/, content/, data/, i18n/, static/, archetypes/
├── scripts/                        # Repository build and checking tools
└── docs/
```

Run production validation from the repository root:

```bash
npm run build
npm run check:public:prod
npm run check:agent:prod
npm run check:browser:install
npm run check:browser:public
```

`npm run dev` starts Hugo at `http://localhost:13241/` and watches the local
module. Template and asset edits in `module/` rebuild the running demo. Production
builds are minified and receive CSP post-processing; development builds are not
minified. Semantic releases of the subdirectory module use tags such as
`module/v0.1.0`.

The demo deliberately avoids product, legal, or brand-specific content. Keep
site customization in the root and reusable theme behavior in `module/`.

## Features

- Built-in multi-language switcher (English, Simplified Chinese, Traditional Chinese)
- Dark / Light / Auto mode toggle
- Default SSR list pages with client-side sorting via URL params
- Optional recursive `all/` list views for home and sections
- Minimalist CSS architecture
- Content-driven taxonomy bundles, with hierarchical `tags` recommended by default and rendering defined in each taxonomy root bundle

## Agent Access

In multilingual sites where the default language lives at the root,
`/llms.txt` is the global agent index. During that render, Banyan also publishes
the default-language sidecar at `/<default-language>/llms.txt`, matching the
shape Hugo uses for multilingual sitemaps.

Language indexes link directly to canonical HTML pages. They include the
language home, `/about/`, and regular pages from the `d` content section.
Utility pages and taxonomy indexes stay outside the curated
index without requiring per-page output flags.

Article meta exposes `GitHub` when `params.content_source.repository` is set
and the current page has a Hugo source file. The theme leaves the repository
empty by default; configure the site's own content repository in `hugo.toml`.

Source links use the configured branch instead of the build revision. This keeps
new pages predictable before their first public commit, while the Powered by build
surface remains the place for exact deployment provenance:

```toml
[params.content_source]
repository = "https://github.com/owner/repo"
branch = "main"
content_root = "content"
```

Copies published on platforms whose URLs cannot be derived are declared on the
corresponding page. GitHub renders first, followed by these entries in front
matter order:

```yaml
published_links:
  - label: WeChat
    url: https://example.com/wechat-article
  - label: Xiaohongshu
    url: https://example.com/xiaohongshu-note
  - label: X
    url: https://example.com/x-post
```

Each entry requires a label and an absolute `https://` URL. Translations own
their lists independently because their platform publications may differ.

## Layout Slots

Banyan's current page shell is assembled from a small fixed slot set rather than
free-form fragment injection.

See [`docs/layout-slots.md`](docs/layout-slots.md) for the current slot names,
their semantics, and the boundary between page slots and site configuration.

## Security

The current CSP and browser-security regression path is documented in:

- [`docs/security-csp.md`](docs/security-csp.md)
- [`docs/security-csp-enforce-checklist.md`](docs/security-csp-enforce-checklist.md)
- [`docs/browser-regression.md`](docs/browser-regression.md)
- [`docs/browser-workflows.md`](docs/browser-workflows.md)

The current dual-stack prefetch model is documented in:

- [`docs/prefetch-stacks.md`](docs/prefetch-stacks.md)

Banyan keeps prefetch and Service Worker behavior opt-in by default:

```toml
[params.prefetch_runtime]
mode = "enable" # off | enable

[params.service_worker]
mode = "enable" # off | enable | disable
```

If your runtime config uses `sw_*` prefetch modes, `params.service_worker.mode`
must also be `enable`. Sites that do not want Service Worker caching can leave
both modes as `off`, or enable `prefetch_runtime` only with link-only modes.

## Web App Manifest

Banyan emits a fingerprinted web app manifest by default. Sites that want the
manifest to stay behind render-critical resources can defer the manifest link to
the end of `<head>`:

```toml
[params.web_app_manifest]
mode = "defer" # link | defer | off
```

Use `link` when the manifest should be discovered as early as possible, `defer`
when the manifest is useful but not part of the first screen, and `off` for
sites that do not need installability metadata.

Banyan keeps root favicon files and PWA resources on separate paths:

- `static/favicon.ico` and `static/favicon.svg` publish the browser root
  favicon fallbacks at `/favicon.ico` and `/favicon.svg`.
- `assets/site/pwa/favicon.svg` is the fingerprinted SVG favicon explicitly linked
  by pages.
- `assets/site/pwa/icon-180.png`, `icon-192.png`, `icon-256.png`, and `icon-512.png`
  are fingerprinted Hugo resources used by the apple-touch icon and web app
  manifest.
- Sites can override the favicon and PWA icons by providing files with the same
  names under their root `assets/site/pwa/` directory.

## Taxonomies

Declare taxonomies in your site's root `hugo.toml` under `[taxonomies]`.
Banyan's recommended default is hierarchical `tags`:

Example:

```toml
[taxonomies]
tag = "tags"
```

`tags` classify pages by topic. One page may belong to multiple independent
paths such as `ai` and `tooling/devtools/windows`.

Each taxonomy must provide an explicit root bundle at
`content/<plural>/_index.<lang>.md` and define Banyan rendering metadata in
`[banyan_taxonomy]`.

Example custom tree taxonomy root bundle:

```toml
+++
title = "Universal Decimal Classification"
linkTitle = "UDC"

[banyan_taxonomy]
mode = "tree"
article_weight = 40
normalize = "lower"
article_mode = "leaf_paths"
+++
```

Notes:

- Hugo's `[taxonomies]` declaration in the site root is still required to create the taxonomy itself.
- Banyan no longer reads taxonomy labels or rendering config from theme `i18n` or `params.banyan.taxonomies.<plural>`.
- Every taxonomy root and term bundle must provide a non-empty `title`. It is the full semantic title used by metadata, schema, and tooltips.
- `linkTitle` is optional compact text for navigation, breadcrumbs, lists, and article taxonomy labels; it falls back to `title`.
- `[banyan_taxonomy].label` and `[banyan_taxonomy].home_label` are removed and are not read.
- Required `[banyan_taxonomy]` keys are: `mode`, `article_weight`, `normalize`, and `article_mode`.
- Attach taxonomy metadata and resources with `content/<plural>/_index.<lang>.md`; terms used by content require matching bundles such as `content/<plural>/<term>/_index.<lang>.md`.
- Follow the current bundle contract in [docs/taxonomies.md](docs/taxonomies.md); module content participates in the live build and provides overridable defaults.
- See [docs/taxonomies.md](docs/taxonomies.md) for hierarchical tags and multi-path behavior.

## License
MIT
