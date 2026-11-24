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
An extracted project ZIP pins the released Module in `go.mod`. Run `swban server` for site edits or `swban dev` to preview the bundled theme source.

The Module tag `module/vX.Y.Z` marks the theme source. The project tag `vX.Y.Z` marks the tested site pinned to that Module version. Go requires the `module/` tag prefix because the Module
root is the `module/` subdirectory. Sites still request `<module>@vX.Y.Z`.

## Change the version

Choose the starting and target versions. Upgrades and downgrades use the same steps.
Run `swban help upgrade/git` for the version comparison commands.
Keep the official checkout under `swaw/banyan/<task>/` in the system temporary directory.
Run `swban upgrade/version/current` from the site root. Use its `old` field as
`<old>` and the selected official project tag or commit as `<new>`.
The command uses Hugo's active dependency, including vendor and remote replacements.
For local source checkouts, it verifies that HEAD belongs to the current official
remote history, then reports that commit and any uncommitted source changes.
It reads official refs without fetching; unavailable evidence produces `old: null`.

If `old` is null, or a previous migration is incomplete, use the target reference site
to review the configuration and page archetypes in full. Migrate step by step or set up from it as a new site;
retain the site's content, languages and branding. Review local theme edits and overrides
before replacement. Complete validation before recording the target as the next base.

For a known base with local theme edits, preserve the active source first. Compare
official old against local to identify customizations, then old against new to identify
upstream changes. Merge both before updating dependencies or regenerating vendor files.

When the base is known and the previous migration is complete, compare official
`<old>` and `<new>`, then inspect the affected site files.
Compare `hugo.toml`, `assets/` and `i18n/` for changes to settings, resources and interface labels.
Compare `module/archetypes/` by layout, then apply relevant changes to sections, articles and their translations. Check the parent cascade for inherited fields. For Powered by, compare the page body as well.

For changes in `module/archetypes/shortcodes.toml`, search site content and translations by the old shortcode name.

When upgrading from a version without matching archetypes, use the release notes and the old and new reference pages to identify required edits. Preserve local URLs, text and branding. Check maps and resource bundles for affected features, the minimum Hugo version in `module/theme.toml` and local Module overrides.

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
Copy `assets/deploy/settings.toml`, `assets/site/` brand assets and the enabled
languages' `i18n/` dictionaries from the reference site. Include the pages the site needs.
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
