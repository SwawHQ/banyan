# Install Banyan

Use the `module` path and `version` from `SKILL.md` metadata. In the commands
below, replace `<module>` with that path and `<version>` with that version
without a leading `v`. `swban` means this Skill's `swban.cmd`, invoked from the
target site's root. The entry prepares Node/npm and required tools on demand. Use
`swban base/packages/ensure` to prepare core parser packages before working offline.

## Start from the reference site

For a new site, clone or extract the complete Banyan repository. Use its root as
your site, then replace its site information, content and identity images.
The root contains the configuration, Skill and site files needed to start.
Upgrade the Module or theme code separately; review root-file differences
between your starting version and the target version before changing site files.

Review these site-owned files when adapting an existing site:

| Site files | Use |
| --- | --- |
| `assets/site/favicon.ico` | Fixed `/favicon.ico` output |
| `assets/site/favicon.link.svg` or `favicon.link.ico` | Fingerprinted icon link; SVG takes priority |
| `assets/site/icon-180.png` | Apple touch icon |
| `assets/site/icon-192.png`, `icon-256.png`, `icon-512.png` | Manifest icons |
| `assets/site/manifest.webmanifest.tmpl` | Complete site manifest template |
| `assets/site/robots.txt.tmpl` | Crawler rules and sitemap URL; used when `enableRobotsTXT` is true |
| `assets/site/delivery.toml` | Complete site delivery policy |
| `assets/site/icons.toml` | Named SVG icons |
| `assets/site/theme.css` | Complete site palette, selected by `params.appearance.palette` |
| `assets/i18n/<language>.toml` | Interface dictionary for each enabled language |

For an existing site, copy missing resources from the reference root and review
its configuration changes without overwriting the site's identity or values.
The Module and traditional theme directory provide no configuration, dictionary
or identity-file defaults. Keep these resources complete when upgrading.

At least one favicon source, the four PWA PNG files and the manifest template
are required even when the Service Worker is off. `favicon.link.*` supplies the
fingerprinted page icon; `favicon.ico` publishes independently at the root URL.
Additional brand media is optional. Configure redirects in
[Delivery configuration](delivery.md#configuration) and downloads in
[External resources](external-resources.md).

All pages belong to root `content/`; the Module provides no fallback pages.
Copy the functional pages the site needs. When SW mode is `enable`, each
enabled language needs a published offline page; see
[Delivery configuration](delivery.md#configuration) for the requirements.
Home art is optional; see [Home art](home-art.md) when using it.

Copy `archetypes/banyan.md` when using the article generator; the Module does
not supply content templates. Page examples and creation commands are in
[Content and layouts](content.md).

Select a complete site palette with `params.appearance.palette`, using a path
relative to `assets/`. The Module supplies no default palette. The manifest
publishes at `/site/site.<hash>.webmanifest`, and images use fingerprinted
paths under `/site/`.

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

For source provenance, upgrades and local replacements, read
[Version changes and local Module tests](upgrade.md).

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

## Configure the site

A new site copied from the reference repository already has its configuration.
Replace its identity, languages and content. When adapting an existing site,
read [Site configuration](site-configuration.md) for the root configuration,
internal pages and language setup. Choose page layouts from
[Content and layouts](content.md) only as needed.

## Verify the result

Run from the site root. Replace `<build>` with an absolute build path, preferably
`swaw/banyan/upgrade/preview/` under the system temporary directory:

```text
swban doctor                                                            #Check tools and theme pairing
swban base/hugo --minify --destination "<build>" --cleanDestinationDir  #Build into a clean destination
swban check/delivery "<build>"                                          #Check delivery output
swban check/csp "<build>"                                               #Check CSP
swban check/browser/site "<build>"                                      #Check representative pages
```

Preview the site's actual pages and select further checks for the changed
features. Missing or unpublished release tags must be resolved explicitly;
do not substitute an unpinned branch or silently change the requested version.
