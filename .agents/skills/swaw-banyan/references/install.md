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

## Configure the site root

Banyan supplies custom output format definitions, but the site must select
its outputs, taxonomies and permalinks. This is a starting point; merge it into
an existing configuration instead of replacing the whole file:

```toml
baseURL = "https://example.com/"
title = "My site"
enableRobotsTXT = true

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
```

`disableJS` preserves the inline bytes used for CSP hashes. Keep existing
permalinks unless the user requests URL changes. Review language settings and
set each language's social locale under `languages.<code>.params.locale`.
The theme has English, Simplified Chinese and Traditional Chinese defaults.

For cache or deployment overrides, create site-owned `data/cache-policy.toml`;
the Module's `data/cache-policy-default.toml` supplies defaults. Hugo generates
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
