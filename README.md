# Banyan for Hugo

A minimalist, multi-language Hugo theme. The repository root builds the
[official documentation site](https://banyan.swaw.com/).

See the [changelog](content/changelog/_index.md) for theme and Skill changes.

## Preview the Site

The CLI currently supports Windows x64. After cloning, prepare tools through
the bundled Skill. It reuses compatible system tools or downloads portable
versions. CLI setup accepts Bun or Node and needs no npm install:

```powershell
git clone https://github.com/SwawHQ/banyan.git
cd banyan
.\.agents\skills\swaw-banyan\swban.cmd ensure
.\.agents\skills\swaw-banyan\swban.cmd git.ensure
.\.agents\skills\swaw-banyan\swban.cmd go.ensure
.\.agents\skills\swaw-banyan\swban.cmd hugo.ensure
.\.agents\skills\swaw-banyan\swban.cmd hugo server -D --disableFastRender --port 13241
```

## Install in Your Own Site

The Skill and Hugo Module use the same release version. The source is
[`SKILL.md` metadata](.agents/skills/swaw-banyan/SKILL.md): Skill `0.1.0`
pairs with Module `v0.1.0`. The examples describe the first release;
the version is not available remotely until its tags are published.

- **Skill first:** install `.agents/skills/swaw-banyan` from the repository's
  `v0.1.0` tag using an installer that supports refs, or extract that directory
  from the tagged repository archive. Place it in your site's
  `.agents/skills/swaw-banyan/`. Ask your Agent to configure Banyan; it prepares
  tools and installs the matching Module. Copying the Skill alone runs nothing.
- **Module first:** inspect `hugo mod graph` in your site. Install the Skill
  from the repository tag matching the resolved Module version. An existing
  Module does not need an upgrade just to install its matching Skill.
- **Both installed:** run `swban check/module` from the site root. If versions
  differ, choose a Module upgrade or the matching Skill before version-specific
  changes. An already requested upgrade does not need a second decision.

Here and below, `swban` means the installed Skill's `swban.cmd`; invoke it by
path from the target site. Follow the Skill's self-contained
[installation guide](.agents/skills/swaw-banyan/references/install.md) for module
initialization, pinned installation, root configuration and vendor updates.
A clone of this repository uses its local Module and reports `development`.

## Setup (Crucial Step)

Due to Hugo's configuration merging rules, structural configurations like
`[outputs]`, `[taxonomies]`, and `[permalinks]` **must** be defined in your
site's root configuration file. Banyan provides its custom `[outputFormats]`,
but the root site still needs `[outputs]` entries to enable them.

Sites must also define this in their root `hugo.toml` so Hugo preserves the
esbuild output used for inline CSP hashes:

```toml
[minify]
disableJS = true
```

The repository's root `hugo.toml` is the starter configuration. The site consumes
`github.com/SwawHQ/banyan/module` through Hugo Modules; its root `go.mod` replaces
that dependency with `./module` for local development. No module release is
needed to build the site or preview changes.

Customize root content, `baseURL`, `title`, language settings, and deployment
params to build your own site. Site files override corresponding module files.
The published theme module contains only `module/`; documentation content and repository
tools are outside that module.

New consumers must declare their active languages and create home and taxonomy
bundles. The Skill's [installation guide](.agents/skills/swaw-banyan/references/install.md)
provides an English starter and a local Module example for temporary checks.

Set the shared site description in your root `hugo.toml`:

```toml
[params]
description = "Your site description."
```

For localized copy, override `languages.<lang>.params.description`. Pages may
define their own front matter `description`; otherwise SEO and social cards use
the site description. `llms.txt` also uses the site description for its intro
and home entry.

Keep each language's social locale in `languages.<lang>.params.locale`; Banyan
uses it for Open Graph locale tags.
An optional `languages.<lang>.params.icon = { text = "EN" }` supplies the short marker shown
by the language choice list; when absent, Banyan uses its language icon.

To configure prefetch, Service Workers, response headers, or deployment metadata,
create a site-owned `data/delivery.toml`. Start from
`module/data/banyan/delivery.toml` when changing routes: a site's `routes`
array replaces the default array, including when empty. Tables merge with the
defaults. Runtime settings apply to all languages.

```toml
[platform.edgeone.makers]
hugoVersion = "0.157.0"

[[routes]]
path = "/*"
http.headers.Cache-Control = "public, max-age=900, must-revalidate"
sw.bucket = "versioned"

[[routes]]
path = "/js/*"
http.headers.Cache-Control = "public, max-age=31536000, immutable"
http.cloudflare.pages.unset = ["Cache-Control"]
sw.bucket = "fingerprinted"

[[routes]]
path = "/sw.js"
sw.bucket = "off"
```

This abbreviated example shows the format; retain the other default routes
when configuring a site. Declare general rules first and exceptions last.
`path` supports exact paths or one `*` anywhere, including `/*.xml` and
`/site/pwa/*.webmanifest`. The wildcard can match an empty string or cross `/`.
SW matches the case-sensitive URL pathname, including percent encoding, without
query or fragment. Use encoded paths for non-ASCII characters.

`http.headers` applies to both platforms. `http.cloudflare.pages.headers` and
`http.edgeone.makers.headers` override common values within that route; Cloudflare's
`unset` removes previously applied headers before setting that route's values.
HTTP routes keep declaration order and use each platform's native behavior.
The generated CSP uses the actual inline scripts; keep `minify.disableJS = true`.

SW uses `sw.bucket`: `versioned` caches responses for the current build,
`fingerprinted` keeps content-hashed URLs across builds, and `off` leaves
requests to the browser. Both cache buckets use cache-first for same-origin
GET requests. The last matching SW rule wins; HTTP-only rules do not change
SW behavior. Unmatched requests are not cached by SW.

The default `/*` rule covers pages and other same-origin GET requests, including
JSON and XML. Use a later `off` rule to exclude a path. On a cache miss, versioned
requests validate the HTTP cache; fingerprinted requests retain normal HTTP
cache behavior. Page query normalization and offline HTML fallback remain
internal to the worker. Related-resource warmup selects only fingerprinted
URLs; other versioned resources are cached when requested. HTTP headers and
SW policies do not infer each other.

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

The documentation site is a consumer of the local theme module:

```text
banyan/
├── hugo.toml, go.mod                # Documentation site configuration
├── content/                        # Site content
│   ├── docs/                       # Configuration guides and development reference
│   └── changelog/                  # Theme and Skill release notes
├── data/                           # Site-owned data
├── module/                         # Published Hugo Module and defaults
│   ├── go.mod, hugo.toml
│   └── layouts/, assets/, content/, data/, i18n/, static/, archetypes/
├── .agents/skills/swaw-banyan/       # Portable toolchain and tasks
└── tests/                          # Theme and tooling source tests
```

Run from the repository root. Below, `swban` means the bundled
`.agents/skills/swaw-banyan/swban.cmd` entry:

```powershell
swban hugo --minify --gc --cleanDestinationDir
swban hugo --minify --destination ./preview
swban hugo server -D --disableFastRender --port 13241
```

`swban hugo` passes arguments directly to Hugo. Use `--destination` to select
an output directory and `hugo server` to preview the site. See
[Skill usage](.agents/skills/swaw-banyan/SKILL.md) for setup and behavior.

These checks and reports use the selected Bun or Node without npm dependencies:

```powershell
swban check/csp
swban check/sri
swban check/html/metadata
swban check/html/styles
swban check/llms
swban report/size/html --top 5
swban report/size/assets
```

Checks return a nonzero exit code when output violates a contract. Reports
print measurements independently. Output commands default to `public/` and
accept a different directory as their first argument.

Content field checks and responsive images use the selected Hugo's resolved
configuration. They need prepared Hugo, Go and Git but no site npm packages.
Run `swban help` for all fine-grained check and report commands.

Browser checks use the Skill's prepared browsers. Start with representative
site coverage and select leaf checks for changed behavior:

```text
swban ensure/browser                        #Prepare Chromium
swban check/browser/site <build>            #Check representative pages
swban check/browser/site <build> --updates  #Check SW updates
swban check/browser/site --help             #Show parameters
```

The [browser guide](.agents/skills/swaw-banyan/references/browser-site.md)
lists coverage, page requirements, reports and WebKit selection. Use each task's
`--help` for its parameters. Browser checks serve a completed build with its
generated headers. Source tests and fault fixtures are described in
[tests/README.md](tests/README.md). Consumer sites keep business expectations
in their own tests.

Sync declared external files and generated EdgeOne config through the Skill:

```powershell
swban sync/ext
swban sync/ext wsl-distribution-info
swban deploy/edgeone/sync ./preview
```

External resources are declared in site-owned `data/external-resources.yaml`.
The first command syncs all declarations; the second selects one id. The demo
starts with an empty list. These tasks include their dependencies and require
no site npm install. `deploy/edgeone/sync` copies generated config to the site root;
its source directory defaults to `public`. It does not build or upload a site.
Build with `swban hugo` and run the needed checks explicitly. Hosted builds use
native Hugo and the platform's tools; they do not install the Skill. Platform
publication will consume completed output. Upload commands are not implemented;
see the Skill's [EdgeOne notes](.agents/skills/swaw-banyan/references/edgeone.md).

The preview command starts Hugo at `http://127.0.0.1:13241/` and watches the local
module. Template and asset edits in `module/` rebuild the running demo. Production
builds are minified and Hugo generates CSP headers directly; development builds
are not minified. Sites must keep `[minify] disableJS = true` in their root
`hugo.toml`: esbuild owns JS minification, and subsequent HTML minification must
preserve the inline bytes used for CSP hashes. Semantic releases of the subdirectory module use tags such as
`module/v0.1.0`.

The demo deliberately avoids product, legal, or brand-specific content. Keep
site customization in the root and reusable theme behavior in `module/`.

## Publish the Skill and Theme Module

Record changes users can observe or must act on. Group related changes;
omit internal refactors, test details and changes limited to consumer sites.

Maintain release notes in `content/changelog/unreleased/index.md`. At release,
move it to `content/changelog/vX.Y.Z/index.md`, set its title and slug to
`vX.Y.Z`, and set `date` and `lastmod` to the release date. Create a new
unreleased bundle.
The existing collection layout lists version pages automatically.
Set `SKILL.md` metadata to that version and commit the changes.
Publish both tags on that commit; the example uses the current `HEAD`:

```powershell
swban git tag v0.1.0 HEAD
swban git tag module/v0.1.0 HEAD
swban git push --atomic --no-follow-tags origin tag v0.1.0 tag module/v0.1.0
```

Create one GitHub Release on `v0.1.0`. If attaching a Skill ZIP, include the
Skill directory and its license; exclude `.tools`, `node_modules` and caches.
The `module/v0.1.0` tag lets Go resolve the `module/` subdirectory separately.

Powered by reads the effective module version through
[`hugo.Deps`](https://gohugo.io/functions/hugo/deps/). Local replacements display
"Local development"; module-scoped dirty status and Git revisions are diagnostics.
The site's timestamp-based build/PWA version remains separate.

GitHub CLI is optional. Prepare it when creating a GitHub Release:

```powershell
swban gh.ensure
swban gh auth login --web
swban gh release create --help
```

The demo's planned address is `https://banyan.swaw.com/`. Build with that
`--baseURL` for deployment. Its Powered by links to `/changelog/` through
`params.theme_changelog`; other sites default to the repository's release notes.

After publishing the version page and pushing the release tag, link the notes
from the GitHub Release:

```text
swban gh release create v0.1.0 --verify-tag --notes https://banyan.swaw.com/changelog/v0.1.0/  #Link release notes
```

Add the Skill ZIP path to attach it. `--verify-tag` prevents an implicit new tag.

## Features

- Built-in multi-language switcher (English, Simplified Chinese, Traditional Chinese)
- Dark / Light / Auto mode toggle
- Default SSR list pages with client-side sorting via URL params
- Optional recursive `all/` list views for home and sections
- Minimalist CSS architecture
- Content-driven taxonomy bundles, with hierarchical `tags` recommended by default and rendering defined in each taxonomy root bundle

## Sitemap

Sitemaps include rendered, indexable HTML pages, including `build.list: local`
and `build.list: never`. Set `sitemap.disable: true` in a page's front matter
to exclude it, or use `cascade.sitemap.disable: true` in a section bundle
to exclude that section and its descendants. This setting does not stop HTML rendering or indexing.
Pages with `robots: noindex` or `robots: none`, translation placeholders and
404 pages are excluded automatically, including from alternate-language links.

```yaml
sitemap:
  disable: true
```

Use `hugo server --disableFastRender` when checking sitemap changes in a preview.
Fast previews can retain the previous XML output. Custom HTML layouts must
inherit Banyan's `baseof.html`, which registers rendered pages for the sitemap.

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

See [Layout slots](content/docs/guide/layout-slots/index.zh.md) for the current slot names,
their semantics, and the boundary between page slots and site configuration.

## Security

The current CSP and browser-security regression path is documented in:

- [Security and CSP](content/docs/guide/security-csp/index.zh.md)
- [Browser checks](content/docs/development/browser-regression/index.zh.md)

The prefetch configuration and backend selection are documented in:

- [Prefetch configuration](content/docs/guide/prefetch-stacks/index.zh.md)

Banyan keeps prefetch and Service Worker behavior opt-in. Set these in
`data/delivery.toml`:

```toml
[prefetch]
enabled = true

[service_worker]
mode = "enable" # off | enable | disable
```

Prefetch selects one backend: native Speculation Rules, an active matching
Banyan Service Worker, or link prefetch. Service Worker caching has its own
switch. Leave `service_worker.mode` as `off` when the site does not need it.

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
- Every taxonomy root and term bundle must provide a non-empty `title`. It is the full semantic title used by metadata, schema, and tooltips.
- `linkTitle` is optional compact text for navigation, breadcrumbs, lists, and article taxonomy labels; it falls back to `title`.
- Required `[banyan_taxonomy]` keys are: `mode`, `article_weight`, `normalize`, and `article_mode`.
- Attach taxonomy metadata and resources with `content/<plural>/_index.<lang>.md`; terms used by content require matching bundles such as `content/<plural>/<term>/_index.<lang>.md`.
- Follow the current bundle contract in [Taxonomies](content/docs/guide/taxonomies/index.zh.md); module content participates in the live build and provides overridable defaults.
- See [Taxonomies](content/docs/guide/taxonomies/index.zh.md) for hierarchical tags and multi-path behavior.

## License

Banyan's original code and documentation are licensed under [MIT](LICENSE).
Copyright (c) 2026 [WY Swaw LLC](https://swaw.com)
([SwawHQ on GitHub](https://github.com/SwawHQ)).

The [Hugo module](module/LICENSE) and
[swaw-banyan Skill](.agents/skills/swaw-banyan/LICENSE) include the same license
for independent distribution. Third-party code and resources retain their own
licenses and copyright notices.
