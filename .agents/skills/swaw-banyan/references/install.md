# Install Banyan

Use the `module` path and `version` from `SKILL.md` metadata. In the commands
below, replace `<module>` with that path and `<version>` with that version
without a leading `v`. `swban` means this Skill's `swban.cmd` on Windows x64,
or `sh <skill>/swban` on Linux x64 or macOS x64/ARM64, invoked from the
target site's root. The entry prepares Node/npm and required tools on demand. Use
`swban base/packages/ensure` to prepare core parser packages before working offline.

Linux needs sh, basic system utilities, curl, tar and sha256sum. macOS uses its
built-in utilities. Python, Homebrew and Xcode are not required. Git uses the
GitHub Desktop portable distribution when no compatible Git is available.
Tools use the selected binding, a managed installation, or a compatible PATH
installation before downloading a verified official archive. Keep each platform's
`.tools/` directory separate. From the reference site root, use `sh ./swban build`.

## Start from the reference site

For a new site, clone or extract the complete Banyan repository. Use its root as
your site, then replace its site information, content and identity images.
Keep `go.mod` and `go.sum`. Use `swban server` to preview and `swban build` to build with the pinned Module. A new site that uses the published theme can remove `module/` and `hugo.work`. Keep both in a Banyan theme checkout for `swban dev` and `swban dev/build`.
Upgrade the Module or theme code separately; review root-file differences
between your starting version and the target version before changing site files.

Review these site-owned files when adapting an existing site:

| Site files | Use |
| --- | --- |
| `assets/site/favicon.ico` | Fixed `/favicon.ico` output |
| `assets/site/favicon.link.svg` or `favicon.link.ico` | Fingerprinted icon link; SVG takes priority |
| `assets/site/apple-touch-icon.png` | Apple touch icon |
| `assets/site/pwa-192.png`, `pwa-256.png`, `pwa-512.png` | Manifest icons |
| `assets/deploy/settings.toml` | Platform switches, SW mode and prefetch switch |
| `assets/deploy/redirects.toml` | Optional URL redirects in declaration order |
| `assets/deploy/external-resources.toml` | Optional files downloaded by `swban sync/resources` |
| `assets/site/avatar.github.svg` | Avatar shared by the reference site’s GitHub pages |
| `i18n/<language>.toml` | Interface dictionary for each enabled language |

For an existing site, copy missing resources from the reference root and review
its configuration changes without overwriting the site's identity or values.
Keep the site deployment settings, redirects, dictionaries and identity images when upgrading.

Supply at least one favicon source and the Apple touch icon. The default manifest also requires the three install icons. Set `params.manifest.enabled = false` in `hugo.toml` to omit the manifest. `favicon.link.*` supplies the
fingerprinted page icon; `favicon.ico` publishes independently at the root URL.
Additional brand media is optional. Configure redirects in
[Delivery configuration](delivery.md#configuration) and downloads in
[External resources](external-resources.md).

All pages belong to root `content/`; the Module provides no fallback pages.
Copy the functional pages the site needs.
Use the optional [wind shortcode](home-art.md) in page content.

The Module supplies a matching archetype for each page layout. Page examples and creation commands are in
[Content and layouts](content.md).

Select a complete site palette with `params.appearance.palette`, using a path
relative to `assets/`. The Module includes the default, high-contrast and Rose palettes,
the named SVG icons, and the manifest and robots templates. To customize one,
copy the complete file from the Module to the same path in your site. The manifest
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
swban build --destination "<build>"                                    #Build pages and search index
swban check/delivery "<build>"                                          #Check delivery output
swban check/csp "<build>"                                               #Check CSP
swban check/browser/site "<build>"                                      #Check representative pages
```

Preview the site's actual pages and select further checks for the changed
features. Missing or unpublished release tags must be resolved explicitly;
do not substitute an unpinned branch or silently change the requested version.
