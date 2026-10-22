# Install or align Banyan

Use the `module` path and `version` from `SKILL.md` metadata. In the commands
below, replace `<module>` with that path and `<version>` with that version
without a leading `v`. `swban` means this Skill's `swban.cmd`, invoked from the
target site's root. The entry runs with Node and prepares Node/npm and required
tools on demand. `sync/ext` and content checks also prepare parser packages in
the Skill's `node_modules/` with npm when needed. Use `swban base/packages/ensure`
to prepare them before working offline.
For isolated Python runtimes and CLI packages, see [Python tools](python.md).

## Inspect an existing site

After installing or changing the theme or tools, run `swban doctor`.
If it reports missing packages, run `swban base/packages/ensure` and retry.
Doctor checks selected tools and reads Hugo's dependency graph, including effective
vendor versions, replacements and theme directories. A theme selected with
`theme = "banyan"` is checked using its `theme.toml` name and version. Hugo supplies
the active directory, including custom `themesDir` settings and renamed folders.
Resolution may populate Hugo's cache and
dependency sums; it does not request a version upgrade.
Ordinary commands do not check theme pairing. Doctor reports `matched` or
`development` for a usable pair; other states need attention.

| Result | Action |
| --- | --- |
| `matched` | Continue with this Skill. |
| `development` | Continue joint development of the local Skill and theme. |
| `missing` | Inspect the site's imports or theme setting. |
| `mismatch` | Use the Skill matching the theme, or perform the authorized theme upgrade. |
| `unverified` | Inspect the local replacement or theme metadata before version-specific changes. |

To retain a published Module version `vX.Y.Z`, obtain this Skill's directory
from the [Banyan project](https://github.com/SwawHQ/banyan) tag `vX.Y.Z`.
A local replacement from another
checkout cannot be identified as a release by its `go.mod` requirement.
Version matching does not verify that local or vendored source files are unmodified.
An extracted project ZIP needs no `.git` directory. Its
`.agents/skills/swaw-banyan/` and `module/` use `module/theme.toml` for version pairing.

The project tag `vX.Y.Z` and Module tag `module/vX.Y.Z` point to the same
repository commit. Go requires the `module/` tag prefix because the Module
root is the `module/` subdirectory. Sites still request `<module>@vX.Y.Z`.

## Add the Module

Hugo commands prepare Git, Go and Hugo as needed. For an existing site with a
fresh Skill, run `swban base/hugo version` before doctor.

If the site has no `go.mod`, initialize its own module identity first:

```text
swban base/hugo mod init <your-site-module-path>
```

Add one import to the site's Hugo configuration. Use the metadata module path:

```toml
[[module.imports]]
path = "github.com/SwawHQ/banyan/module"
```

Pin the matching release:

```text
swban base/hugo mod get <module>@v<version>
```

Do not copy the demo's `replace ... => ./module` into a published-Module site.
Preserve existing imports, content, languages and URL rules when adapting a site.
If upgrading a vendored site, regenerate its vendor tree with
`swban base/hugo mod vendor` after updating the dependency, then check pairing again.

## Change the version

Choose the target release first. Upgrades and downgrades use the same steps.
Open [project releases](https://github.com/SwawHQ/banyan/releases), select the
target version and download **Source code (zip)**. A tag's ZIP is also available
at `https://github.com/SwawHQ/banyan/archive/refs/tags/vX.Y.Z.zip`.

- **Skill:** obtain `.agents/skills/swaw-banyan/` from project tag `vX.Y.Z`.
  Update the complete Skill source, not just `metadata.version`.
- **Module:** run `swban base/hugo mod get <module>@vX.Y.Z` from the site root.
  If `_vendor/` is used, run
  `swban base/hugo mod vendor` after the version change. A local `replace`
  still takes precedence; remove it to use a published version.
- **Theme directory:** use the extracted archive's `module/` as the active
  theme directory, such as `themes/banyan/`. The directory must contain
  `theme.toml`, `layouts/` and `assets/`. Review local theme edits before replacement;
  keep site customizations in the site. Do not change only `theme.toml` version.

Run `swban doctor` after aligning the Skill and theme. Use a fixed release
instead of `@latest` when choosing a known pair.

## Test an unpublished Module

Use a temporary consumer site and call the Skill from the Banyan checkout.
Its `go.mod` can resolve the local Module without a release:

```go
module example.test/banyan-check

go 1.18

require github.com/SwawHQ/banyan/module v0.0.0

replace github.com/SwawHQ/banyan/module => D:/2026.7/banyan/module
```

Change the replacement path to your checkout's `module/` directory. Keep the
Hugo import above. `doctor` reports `development` when this Module and
the called Skill belong to the same Git checkout. An independently copied Skill
with a local replacement reports `unverified`.
After release, verify a fixed version in a fresh site without a replacement.

## Configure the site root

Banyan supplies custom output format definitions, but the site must select
its outputs, taxonomies and permalinks. This is a starting point; merge it into
an existing configuration instead of replacing the whole file:

```toml
baseURL = "https://example.com/"
title = "My site"
enableRobotsTXT = true
defaultContentLanguage = "en"
defaultContentLanguageInSubdir = false
disableLanguages = ["zh", "zh-tw"]
panicOnWarning = true

[minify]
disableJS = true

[outputs]
home = ["HTML", "RSS", "LLMS"]
page = ["HTML"]
section = ["HTML", "RSS"]
taxonomy = ["HTML", "RSS"]
term = ["HTML", "RSS"]

[taxonomies]
tag = "tags"

[params]
description = "Describe this site."

[languages.en]
languageName = "English"
weight = 1
```

`disableJS` preserves the inline bytes used for CSP hashes. Keep existing
permalinks unless the user requests URL changes. The Module supplies social locales
for English, Simplified Chinese and Traditional Chinese; override
`languages.<code>.params.locale` only when a different locale is needed.
This starter enables English. To enable Chinese, remove it from
`disableLanguages`, declare its root `languages` settings and add its translated
home. The Module supplies translated taxonomy roots, information and settings pages.

Create `content/_index.md` for the site's home:

```markdown
---
root_nav: true
title: My site
description: Describe this site.
layout: page-home
---
```

The declared `tags` taxonomy uses the Module's Discover - Categories page.
The Module also supplies a root for `tools` when the site registers that taxonomy.
No site taxonomy root files are required for these defaults.
To customize a root, copy its complete `content/tags/_index.<lang>.md` or
`content/tools/_index.<lang>.md` from the Module into the same site path.
Hugo replaces the whole content file, so keep its taxonomy and layout declarations.

Before assigning an article to a `tags` term, create that term's bundle, such as
`content/tags/sample/_index.md`, with a title. Add a translated bundle for each
enabled language that uses the term. `tools` terms can be generated without
bundles; add a bundle to supply a translated title, description or other content.

Site content, assets and data at the same paths override Module defaults.
Keep accounts, branding and legal content in the site. `params.theme_changelog`
can set the Powered by release-notes link; its default is the upstream
`content/changelog/` directory.

For prefetch, Service Workers, headers, or deployment, create `data/delivery.toml`;
the Module's `data/delivery.toml` supplies defaults. Hugo replaces each top-level
field declared by the site. Copy a complete table to change it; nested fields
do not inherit omitted Module values. Use
`platform.edgeone.makers` for deployment fields and ordered `routes` with independent
`http` and `sw.bucket` fields (`versioned`, `fingerprinted`, or `off`). A site
route array replaces all default routes, including when empty, and preserves order.
`[prefetch]` and `[service_worker]` apply to all languages.
Enable prefetch with a complete table to use automatic native/SW/link selection:

```toml
[prefetch]
enabled = true
default = "conservative"

[prefetch.prerender]
default = "off"

[service_worker]
mode = "enable"
content_check_interval = 5
offline_notice_path = "offline/"
```

`prefetch.prerender` settings control native prerender for selected icon scopes.
The Module uses moderate prerender for tail folder links.
Column scopes are `root`, `tail`, `"root+N"`, `"tail-N"`, and `all`.
The example replaces the Module's folder settings; add icon scopes when needed.
Platform `enabled` switches control `_headers`, `_redirects` and `edgeone.json`.
Declaring `platform` replaces the entire table; an omitted platform is disabled.
Do not edit output files as configuration. See [delivery checks](delivery.md).

## Verify the result

```text
swban doctor
swban base/hugo --minify --destination ./preview
swban check/delivery ./preview
swban check/csp ./preview
```

Preview the site's actual pages and select further checks for the changed
features. Missing or unpublished release tags must be resolved explicitly;
do not substitute an unpinned branch or silently change the requested version.
