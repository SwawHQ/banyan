# Site configuration

Read this when adapting a site or changing its root configuration, languages,
identity or settings pages. For installation and required assets, see
[Install Banyan](install.md).

## Configure the site root

Each site defines its languages, theme parameters and output formats in its own
`hugo.toml`. The Module has no Hugo configuration file. The complete reference
site already supplies its configuration. Use the example below when adapting an
existing site after supplying its identity files:

```toml
baseURL = "https://example.com/"
taxonomies = {}
defaultContentLanguage = "en"
defaultContentLanguageInSubdir = false
disableLanguages = ["zh", "ar"]
# Render assets/site/robots.txt.tmpl; false disables Hugo's robots.txt output.
enableRobotsTXT = true

panicOnWarning = true
printPathWarnings = true

[minify]
disableJS = true

[markup.highlight]
noClasses = false

[[cascade]]
[cascade.build]
# true: automatically publish page bundle resources, including unused files.
# false: publish only resources whose Permalink, RelPermalink or Publish method is called.
# Page HTML is controlled by build.render; static/ files are copied separately.
publishResources = false

[outputs]
home = ["HTML", "RSS", "LLMS"]

[languages.en]
label = "English"
locale = "en-US"
weight = 1

[[module.mounts]]
source = "assets/i18n"
target = "i18n"

[outputFormats.LLMS]
mediaType = "text/plain"
baseName = "llms"
isPlainText = true
notAlternative = true

[params.appearance]
palette = "site/theme.css"

```

`noClasses = false` keeps code-block styles in external stylesheets.
`disableJS` preserves the inline bytes used for CSP hashes.

### Languages

Each enabled language declares
its native `label` and `locale`. Its settings page's `params.language_icon`
sets the language option icon, for example `{ text: "EN" }`.
This starter enables English.
To enable Chinese, remove it from `disableLanguages`, then add its language
settings, locale, icon, `assets/i18n/<language>.toml` dictionary and required content
translations, including the home. Adding or removing a language requires matching
changes in `hugo.toml`, the site's `assets/i18n/` and its content translations.
The [demo configuration](https://github.com/SwawHQ/banyan/blob/main/hugo.toml)
shows all three languages. The mount above loads site dictionaries.
For right-to-left languages, set `languages.<code>.direction = "rtl"`.
The reference site supplies translated settings and diagnostic pages.

### Internal pages

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
    slots: []
---
```

Keep Hugo fields such as `title`, `url` and `layout` at the top level of front
matter. Put custom page fields under `params`, and inherited defaults under
`cascade.params`. Templates read custom fields such as `.Params.slots` through
`.Params`. Set inherited layouts with `cascade.layout`.

## Site identity and discovery

Set each language's site name in its home page's `title`, not in `hugo.toml`.
The shared PWA manifest uses the default language set by `defaultContentLanguage`.
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

## Language and appearance pages

Language and appearance settings use `content/language/_index.md` with
`layout: page-collection-language` and `content/appearance/_index.md` with
`layout: page-collection-appearance`. Both use `outputs: [HTML]`. Keep translated
labels in `params.labels`; the layouts supply their choices and controls.
Appearance pages define `params.appearance_icons.auto`, `.light` and `.dark`
using SVG names, text or images; `params.icon` remains the navigation entry icon.
Language links work without JavaScript. JavaScript keeps the selected language
when returning to the previous page, and applies and saves appearance choices.

Site layouts and assets at the same paths override Module files. Keep page
text, accounts, branding and legal content in the site's `content/`.

For home and collection layouts, see [Content and layouts](content.md).
For SW, prefetch and platform output, see [Delivery configuration](delivery.md).
