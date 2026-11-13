# Version changes and local Module tests

Read this when changing an existing version or testing an unpublished Module.
Use the module path and version from `SKILL.md`; run commands from the site root.

## Identify the source

To retain a published Module version `vX.Y.Z`, obtain this Skill's directory
from the [Banyan project](https://github.com/SwawHQ/banyan) tag `vX.Y.Z`.
A local replacement cannot be identified as a release by its `go.mod` requirement.
Version matching does not verify that local or vendored source files are unmodified.
For a local theme source with Git history, identify its checkout and local changes:

```text
swban base/git -C "<theme-source>" rev-parse HEAD                           #Read the source checkout commit
swban base/git -C "<theme-source>" --no-optional-locks status --short -- .  #List changes in this source directory
```

`<theme-source>` is the actual directory reported by Hugo or doctor. The commit
identifies that checkout, which may include site-specific commits; it is not proof
of an official release. Without Git history, verify the archive or download source.
`theme.toml` alone declares a version; it does not prove that the files still match it.
An extracted project ZIP needs no `.git` directory. Its
`.agents/skills/swaw-banyan/` and `module/` use `module/theme.toml` for version pairing.

The project tag `vX.Y.Z` and Module tag `module/vX.Y.Z` point to the same
repository commit. Go requires the `module/` tag prefix because the Module
root is the `module/` subdirectory. Sites still request `<module>@vX.Y.Z`.

## Change the version

Choose the starting and target versions. Upgrades and downgrades use the same steps.
Run `swban help upgrade/git` for directory comparisons, filename filters and exclusions.
Keep the official checkout under `swaw/banyan/<task>/` in the system temporary directory.
Run `swban upgrade/version/current` from the site root. Use its `old` field as
`<old>` and the selected official project tag or commit as `<new>`.
The command uses Hugo's active dependency, including vendor and remote replacements.
For local source checkouts, it verifies that HEAD belongs to the current official
remote history, then reports that commit and any uncommitted source changes.
It reads official refs without fetching; unavailable evidence produces `old: null`.

If `old` is null, or a previous migration is incomplete, use the target reference site
to review all four roots in full. Migrate step by step or set up from it as a new site;
retain the site's content, languages and branding. Review local theme edits and overrides
before replacement. Complete validation before recording the target as the next base.

For a known base with local theme edits, preserve the active source first. Compare
official old against local to identify customizations, then old against new to identify
upstream changes. Merge both before updating dependencies or regenerating vendor files.

When the base is known and the previous migration is complete, compare official
`<old>` and `<new>`, then inspect the affected site files.
Start with these four roots:

| Scope | Official paths | Review |
| --- | --- | --- |
| Site configuration | `hugo.toml` | Parameters, mounts, output formats and languages. |
| Content | `content/` | Lists, article/product examples, functional pages and their resources. |
| Site resources | `assets/` | Delivery policy, icons, palettes, templates and interface dictionaries. |
| Content templates | `archetypes/` | Fields used when creating content. |

For shared structure, start with `_index.md` and `index.md`, which are English in this
reference site. Also review affected translations and resources.
Match pages by their layouts, fields and shortcodes; site directory names can differ.
The four roots cover reference-site files. Also check the target's minimum Hugo version
in `module/theme.toml`, theme/Skill pairing, and any local overrides of Module files.
Reference-site language, palette or policy choices are not mandatory migrations.
Preserve site content and branding. Exclude `content/articles/docs/`,
`content/articles/changelog/` and `content/about/` from comparisons as needed.
Actual changes are determined by source differences between the selected versions;
documentation and release notes are references. Copying them into the site is optional.
If omitting them, change Home's documentation link and Powered by's changelog link
to their corresponding pages on `https://banyan.swaw.com/`.
Report affected site files and required edits. Obtain the target files from the checkout
or **Source code (zip)** on [project releases](https://github.com/SwawHQ/banyan/releases).

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

Run `swban doctor` after aligning the Skill and theme, then follow
[Verify the result](install.md#verify-the-result). Pairing and a successful build do not verify
page behavior. Use a fixed release instead of `@latest` when choosing a known pair.

## Test an unpublished Module

Use a temporary consumer site and call the Skill from the Banyan checkout.
Supply its root `assets/site/` with complete configuration files and enabled
languages' `assets/i18n/` dictionaries from the reference site. Include any root
content pages needed by the site.
Its `go.mod` can resolve the local Module without a release:

```go
module example.test/banyan-check

go 1.18

require github.com/SwawHQ/banyan/module v0.0.0

replace github.com/SwawHQ/banyan/module => C:/path/to/banyan/module
```

Change the replacement path to your checkout's `module/` directory. Keep the
[Hugo Module import](install.md#add-the-module). `doctor` reports `development` when this Module and
the called Skill belong to the same Git checkout. An independently copied Skill
with a local replacement reports `unverified`.
After release, verify a fixed version in a fresh site without a replacement.
