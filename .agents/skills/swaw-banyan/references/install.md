# Install or align Banyan

Use the `module` path and `version` from `SKILL.md` metadata. In the commands
below, replace `<module>` with that path and `<version>` with that version
without a leading `v`. `swban` means this Skill's `swban.cmd`, invoked from the
target site's root. The entry runs with Node and prepares Node/npm and required
tools on demand. `sync/ext` and content checks also prepare parser packages in
the Skill's `node_modules/` with npm when needed. Use `swban base/packages/ensure`
to prepare them before working offline.
For isolated Python runtimes and CLI packages, see [Python tools](python.md).

## Start from the reference site

For a new site, clone or extract the complete Banyan repository. Use its root as
your site, then replace its site information, content and identity images.
The root contains the configuration, Skill and site files needed to start.
Upgrade the Module or theme code separately; review root-file differences
between your starting version and the target version before changing site files.

An existing site must supply these files in its own root:

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
| `assets/i18n/<language>.toml` | Interface dictionary for each enabled language |

Copy the reference site's `assets/site/` into an existing site,
then replace the images with its own identity and review the manifest and robots
templates. The Module and traditional theme directory supply neither these icons
nor these templates. At least one favicon source, the four PWA PNG files
and the manifest template are required even when the Service Worker is off.
The selected `favicon.link.*` file supplies the page icon link; `favicon.ico`
publishes independently at the root URL. These files also supply the local
authorization page; it prefers linked SVG, linked ICO, then the fixed ICO.
Importing the Module alone does not supply a complete site.

The site also owns complete `assets/site/delivery.toml`, `assets/site/icons.toml`
and `assets/i18n/` files. Obtain missing files from the reference root and keep the site's
own values. The Module and traditional theme directory provide no configuration
or interface-dictionary defaults to merge. Maintain these site files when upgrading
the theme. Optional redirects use top-level `[[redirects]]` entries in
`assets/site/delivery.toml`; omit them when no rules are needed. External downloads
use `assets/site/external-resources.yaml`.

All pages belong to root `content/`. Offline and prefetch diagnostics live in
`content/_res/` and publish under `_res/`.
Copy the pages you need from the reference site; deleting a page removes it
without a Module fallback. The Module provides layouts, scripts and styles,
without content defaults. SW `enable` requires a published HTML
page at `sw.offline_notice_path` for every enabled language;
`off` and `disable` allow these offline pages to be absent.

The site owns `archetypes/banyan.md`, copied from the reference root.
The Module and traditional theme directory do not supply article templates.
Reference pages show active settings and applicable optional fields in comments.
Omit inherited fields unless the page needs to override them.

```text
swban base/hugo new content --kind banyan articles/my-post/index.md  #Create an article
```

Additional brand media in `assets/site/` is optional. The site maintains the
complete manifest template; the Module reads and executes it to publish
`/site/site.<hash>.webmanifest`. Images publish with fingerprinted URLs under
`/site/*`. The Module retains built-in palettes. To customize a palette, place
a file at the same path in the site's `assets/` directory.
The homepage windsock is inline SVG in `layouts/page-home.html`, without a
separate image request. Override that template in the site to change its shape;
the selected CSS palette controls its colors.

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
Supply its root `assets/site/` with complete configuration files and enabled
languages' `assets/i18n/` dictionaries from the reference site. Include any root
content pages needed by the site.
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

Each site defines its languages, theme parameters and output formats in its own
`hugo.toml`. The Module has no Hugo configuration file. The complete reference
site already supplies its configuration. Use the example below when adapting an
existing site after supplying its identity files:

```toml
baseURL = "https://example.com/"
title = "My site"
defaultContentLanguage = "en"
defaultContentLanguageInSubdir = false
disableLanguages = ["zh", "zh-tw"]
# Render assets/site/robots.txt.tmpl; false disables Hugo's robots.txt output.
enableRobotsTXT = true

panicOnWarning = true
printPathWarnings = true

[minify]
disableJS = true

[[cascade]]
[cascade.build]
# true: automatically publish page bundle resources, including unused files.
# false: publish only resources whose Permalink, RelPermalink or Publish method is called.
# Page HTML is controlled by build.render; static/ files are copied separately.
publishResources = false

[taxonomies]

[outputs]
home = ["HTML", "RSS", "LLMS"]

[languages.en]
label = "English"
locale = "en-US"
weight = 1
params.icon = { text = "EN" }

[module.hugoVersion]
min = "0.168.0"

[[module.mounts]]
source = "assets/i18n"
target = "i18n"

# Banyan output format and parameters.

[outputFormats.LLMS]
mediaType = "text/plain"
baseName = "llms"
isPlainText = true
notAlternative = true

[params.appearance]
palette = "css/theme.css"

```

`disableJS` preserves the inline bytes used for CSP hashes. Preserve each page's
published address in its front matter `url` field. Each enabled language declares
its native `label` and `locale`; `languages.<code>.params.icon` sets its icon.
This starter enables English.
To enable Chinese, remove it from `disableLanguages`, then add its language
settings, locale, icon, `assets/i18n/<language>.toml` dictionary and required content
translations, including the home. Adding or removing a language requires matching
changes in `hugo.toml`, the site's `assets/i18n/` and its content translations.
The [demo configuration](https://github.com/SwawHQ/banyan/blob/main/hugo.toml)
shows all three languages. Keep the native mount above so Hugo reads the site's
dictionaries. The root reference site supplies translated settings and information
pages, including Powered by and prefetch diagnostics. The Module contains no
site content. Each site owns its home, branding and content directories.

Home and published direct children appear in the first navigation column.
Keep `content/_res/_index.md` with the following front matter. It hides `_res`
and its descendants from page collections. The branch has no output; its pages
keep their HTML with `noindex, follow` and `slots: []`. The sites matrix shares
this file across all enabled languages.

```yaml
---
sites:
  matrix:
    languages: ["**"]
build:
  list: never
  render: never
  publishResources: false
cascade:
  build:
    list: never
    publishResources: false
  params:
    robots: noindex, follow
    slots: [] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
```

Keep Hugo fields such as `title`, `url` and `layout` at the top level of front
matter. Put custom page fields under `params`, and inherited defaults under
`cascade.params`. Templates read custom fields such as `.Params.slots` through
`.Params`. Set inherited layouts with `cascade.layout`.

Create `content/_index.md` for the site's home:

```markdown
---
title: My site
description: Describe this site.
layout: page-home
---
```

Set each language's default description in its home page. Page SEO uses the
page's own `description`, then the home page's `description` for that language.
`llms.txt` uses the home description for its introduction and each page's own
description for its entry. Directory groups include `_map.toml` references.
Each group lists a page once; the same page can appear in several groups.

`enableRobotsTXT = true` renders the site-owned `assets/site/robots.txt.tmpl`
through Hugo's robots template. Edit that file with standard crawler directives
and Hugo template functions. Its context is the current site's home page.
The reference template allows all crawlers and declares the sitemap URL.
Set `enableRobotsTXT = false` to disable this output; use a clean build destination
to remove an older generated file. See the
[Hugo robots.txt guide](https://gohugo.io/templates/robots/).

Keep `[taxonomies]` empty to disable Hugo's default tags and categories.
Collection layouts bind their fields, sorting and controls. Use:

| Layout | Lists |
| --- | --- |
| `page-collection` | Direct entries, names only |
| `page-collection-directory` | Direct entries with date and count |
| `page-collection-directory-all` | All articles under `params.aggregate`, with date, size and path |
| `page-collection-products` | Direct entries with price and value |
| `page-collection-products-all` | All articles under `params.aggregate`, with price and value |
| `page-collection-language` | Enabled language links |
| `page-collection-appearance` | Auto, light and dark buttons |

Only the two `-all` layouts use `params.aggregate`, with a source section path.
Choose your own directory names. For example, create `content/articles/_index.md`:

```markdown
---
title: Articles - Categories
description: Browse articles by topic.
layout: page-collection-directory
params:
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  - target: {kind: section}
    layout: page-collection-directory
    params:
      slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
```

Use `params.slots` to list enabled regions. The order does not change the layout.
`breadcrumb` enables path navigation. `meta` enables article metadata, chapters
and BlogPosting on regular article pages. Omit `params.slots` to inherit it;
use `params.slots: []` to disable them.

Powered by and offline pages use `page-article-norss`. The base template loads the
required script once per page when it uses `site-update` or `page-actions`.

Create `content/articles/sample/_index.md` for a nested directory. Its layouts come
from the site's `articles` root:

```markdown
---
title: Sample
description: Sample articles.
---
```

Use `page-article-rss` for articles that may appear in RSS. Use
`page-article-norss` for Markdown pages that must stay out of RSS. Both layouts keep
the same article features. Directory and aggregate feeds apply the same article
selection rule.

Sections default to HTML and RSS outputs. Set
`outputs: [HTML]` to disable a section's feed. Its articles can still appear
in the site feed when they use `page-article-rss`.

Create an article at `content/articles/sample/alpha/index.md`:

```markdown
---
title: Alpha
url: p/alpha/
description: An independent Alpha article.
date: 2026-01-01
params:
  share_image: false
  offer:
    amount: 0
    currency: "$"
    value: An example product.
---

Independent article content.
```

Keep the article's `url` when moving its source. Use a language-relative path
without a leading slash; Hugo adds the current language prefix. Information and
settings pages use their own paths, such as `url: language/`. Directory pages
keep their content paths. No per-section permalink rule is needed.

To list the article in another directory, create `content/articles/related/_index.md`
with its title and description. Put one shared `_map.toml` beside it:

```toml
refs = ["/articles/sample/alpha"]
```

Targets are logical content paths. Each language uses its own target translation.
The reference takes its title and metadata from the article and adds no second
page. A reference directory and its ancestors use `build.list: always` or `local`.
Resource publishing follows Hugo's `build.publishResources` setting, including
`_map.toml`.

Create `content/articles-all/_index.md` to list all articles under `articles`:

```markdown
---
title: Articles - All
description: All articles.
layout: page-collection-directory-all
params:
  aggregate: /articles
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
```

Products use the same directories and references. Create
`content/products/_index.md`:

```markdown
---
title: Products - Categories
description: Browse products by topic.
layout: page-collection-directory
outputs: [HTML, RSS]
params:
  list_icon_file: product
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  - target: {kind: section}
    layout: page-collection-products
    outputs: [HTML, RSS]
    params:
      slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
```

Create `content/products/free/_index.md`:

```markdown
---
title: Free
description: Free products.
---
```

Add `content/products/free/_map.toml` with the same article reference shown above.
The article's `params.offer` supplies its price and value. The same article can occur in
several directories. A product aggregate lists it once. Create
`content/products-all/_index.md`:

```markdown
---
title: Products - All
description: All products.
layout: page-collection-products-all
outputs: [HTML]
params:
  list_icon_file: product
  aggregate: /products
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
```

Add translated content files for each enabled language. Directory references use
one `_map.toml` across languages. The Module provides no pages. Copy optional
settings and information pages from the reference root when needed.

Language and appearance settings use `content/language/_index.md` with
`layout: page-collection-language` and `content/appearance/_index.md` with
`layout: page-collection-appearance`. Both use `outputs: [HTML]`. Keep translated
labels in `params.labels`; the layouts supply their choices and controls.
Language links work without JavaScript. JavaScript keeps the selected language
when returning to the previous page, and applies and saves appearance choices.

Site layouts and assets at the same paths override Module files. The site
maintains all content, configuration resources in `assets/site/` and interface
dictionaries in `assets/i18n/`. Edit page text and front matter in root `content/`;
keep accounts, branding and legal content there too.

Powered by keeps headings, prose, source and changelog links in each language's
Markdown. Use `new-tab` for those external links. `theme-version` outputs only the
theme version, with `label` and `local` text parameters; `hugo-version` uses
`hugo.Version`. `site-update` outputs update status and a check button.

Append diagnostics in the same Markdown. `prefetch-debug-controls` outputs the
transport selector and status. Keep its text in `params.prefetch_debug.labels`,
as shown in the reference pages. `prefetch-debug-links` supplies a published
collection and article in the current language. `prefetch-debug-state` outputs
one live JSON panel: `support`, `env`, `actions`, `runtime` or `payload`.
Write panel headings and instructions in Markdown. Pages with the controls
shortcode load the diagnostic scripts; the backend choice affects that page.
Worker control state reports the same page's state. Review the reference pages
when upgrading, and keep your own page text.

For prefetch, Service Workers, headers or deployment, maintain the complete
site-owned `assets/site/delivery.toml`. Use the Banyan root reference file as a starting
point and preserve the site's values. There is no Module policy to inherit. Use
`platform.edgeone.makers` for deployment fields and ordered `routes` with independent
`http` and `sw.bucket` fields (`versioned`, `fingerprinted`, or `off`). A site
route array declares its own rules and preserves order; `routes = []` declares none.
`[prefetch]` and `[sw]` apply to all languages.
Enable prefetch with a complete table to use automatic native/SW/link selection:

```toml
[prefetch]
enabled = true
default = "conservative"

prerender.default = "off"

[sw]
mode = "enable"
content_check_interval = 5
offline_notice_path = "_res/offline/"
```

`prefetch.prerender` settings control native prerender for selected icon scopes.
The Banyan reference policy uses moderate prerender for tail folder links.
Column scopes are `root`, `tail`, `"root+N"`, `"tail-N"`, and `all`.
The example omits icon-specific settings; add icon scopes when needed.
Product `enabled` switches control `_headers`, `_redirects` and `edgeone.json`.
Set `pages.enabled` and `makers.enabled`; an omitted product is disabled.
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
