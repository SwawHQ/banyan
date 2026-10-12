# Install or align Banyan

Use the `module` path and `version` from `SKILL.md` metadata. In the commands
below, replace `<module>` with that path and `<version>` with that version
without a leading `v`. `swban` means this Skill's `swban.cmd`, invoked from the
target site's root. Prepare CLI, Git, Go and Hugo as described in `SKILL.md`.

## Inspect an existing site

Run `swban check/module`. It reads Hugo's dependency graph, including effective
vendor versions and replacements. Resolution may populate Hugo's cache and
dependency sums; it does not request a version upgrade.

| Result | Action |
| --- | --- |
| `matched` | Continue with this Skill. |
| `development` | Continue joint development of the local Skill and Module. |
| `missing` | Inspect the site's imports and follow setup below if adopting Banyan. |
| `mismatch` | Use the Skill matching the resolved Module, or perform the authorized Module upgrade. |
| `unverified` | Inspect the local replacement and establish its pairing before version-specific changes. |

To retain a published Module version `vX.Y.Z`, obtain this Skill's directory
from the Banyan repository tag `vX.Y.Z`. A local replacement from another
checkout cannot be identified as a release by its `go.mod` requirement.
Version matching does not verify that vendored source files are unmodified.

## Add the Module

If the site has no `go.mod`, initialize its own module identity first:

```text
swban hugo mod init <your-site-module-path>
```

Add one import to the site's Hugo configuration. Use the metadata module path:

```toml
[[module.imports]]
path = "github.com/SwawHQ/banyan/module"
```

Pin the matching release:

```text
swban hugo mod get <module>@v<version>
```

Do not copy the demo's `replace ... => ./module` into a published-Module site.
Preserve existing imports, content, languages and URL rules when adapting a site.
If upgrading a vendored site, regenerate its vendor tree with
`swban hugo mod vendor` after updating the dependency, then check pairing again.

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
Hugo import above. `check/module` reports `development` when this Module and
the called Skill belong to the same checkout. An independently copied Skill
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

[languages.en.params]
locale = "en_US"
```

`disableJS` preserves the inline bytes used for CSP hashes. Keep existing
permalinks unless the user requests URL changes. Review language settings and
set each language's social locale under `languages.<code>.params.locale`.
This starter enables English. To enable Chinese, remove it from
`disableLanguages`, declare its root `languages` settings and locale, and add
its translated home and taxonomy bundles. The Module supplies translated
information and settings pages.

Create `content/_index.md` for the site's home:

```markdown
---
root_nav: true
title: My site
description: Describe this site.
layout: page-home
---
```

The declared `tags` taxonomy needs `content/tags/_index.md`:

```markdown
---
root_nav: true
title: Topics
description: Browse articles by topic.
layout: page-collection
list: directory
cascade:
  - target:
      kind: term
    layout: page-collection
banyan_taxonomy:
  mode: tree
  article_weight: 30
  article_mode: leaf_paths
  normalize: lower
  term_rel: tag
---
```

Before assigning an article to a term, create that term's bundle, such as
`content/tags/sample/_index.md`, with a title. Add a translated bundle for each
enabled language that uses the term.

Site content, assets and data at the same paths override Module defaults.
Keep accounts, branding and legal content in the site. `params.theme_changelog`
can set the Powered by release-notes link; its default is the upstream
`content/changelog/` directory.

For cache or deployment overrides, create site-owned `data/cache-policy.toml`;
the Module's `data/cache-policy-default.toml` supplies defaults. Use
`platform.edgeone` for deployment fields and ordered `routes` with independent
`http` and `sw.bucket` fields (`versioned`, `fingerprinted`, or `off`). A site
route array replaces all default routes.
Hugo generates
`_headers` and `edgeone.json`. Do not edit those output files as configuration.

## Verify the result

```text
swban check/module
swban hugo --minify --destination ./preview
swban check/csp ./preview
```

Preview the site's actual pages and select further checks for the changed
features. Missing or unpublished release tags must be resolved explicitly;
do not substitute an unpinned branch or silently change the requested version.
