# Banyan

English · [简体中文](README.zh-CN.md)

A website template (Hugo theme) for browsing resources and articles by category,
with Miller column navigation.

[Demo](https://banyan.swaw.com/) ·
[Documentation](https://swaw.com/d/banyan/docs/) ·
[Changelog](https://swaw.com/d/banyan/changelog/)

**1.** Miller column navigation

**2.** Content directories with shared cross-directory references

**3.** Article and product list views

**4.** Companion Agent Skill

**5.** Static deployment, asset fingerprints, and CDN caching

**6.** Multiple languages, theme switching, and custom appearance

**7.** PWA, Service Worker caching, and page prefetch

**8.** Automatic CSP and SRI generation

**9.** RSS, social metadata, sitemap, robots.txt, and llms.txt

The repository root owns article (`articles`, `articles-all`) and product (`products`, `products-all`) examples.
They share one article. The root also owns optional settings and information
pages, including Powered by and prefetch diagnostics. The Module supplies reusable
layouts, scripts and styles; it contains no site content.

## Get started

Clone or extract this complete repository as the starting point for your site.
The article template is site-owned `archetypes/banyan.md`.
Keep Hugo fields such as `title`, `url` and `layout` at the top level of front
matter. Put custom page fields under `params`, and inherited defaults under
`cascade.params`.
Use `page-article-rss` for RSS article items, and `page-article-norss` for other Markdown
pages. The `meta` slot enables article metadata, chapters and BlogPosting.
Collection layouts select their fields and behavior: `page-collection`
shows names, `page-collection-directory` shows directory metadata, and
`page-collection-products` shows product values. The directory and product
`-all` layouts require `params.aggregate` with a source section path. Sections
publish HTML and RSS by default; set `outputs: [HTML]` on sections that need no feed.
Language and appearance settings use `_index.md` with
`page-collection-language` or `page-collection-appearance` and output HTML only.
Keep root `assets/site/`, then replace the icons with your own
and review `assets/site/manifest.webmanifest.tmpl` and `assets/site/robots.txt.tmpl`.
The site maintains these templates; the Module and traditional theme directory
do not include site icons or these templates.
Keep complete configuration files in `assets/site/` and the enabled languages'
`assets/i18n/` dictionaries. Keep the project's `assets/i18n` → `i18n` Hugo mount;
the theme does not supply these files. Language changes require matching
`hugo.toml` settings, interface dictionaries and content translations.
Home and published direct children of `content/` appear in the first navigation
column. Set each language's default description in its home page `description`.
For `layout: page-home`, put `{{< home-art "/_res/home-art/wind" >}}` in the
home page body. Keep the selected art in a hidden leaf bundle under
`content/_res/home-art/`, with translated `index.md` files and companion CSS/JS.
The art renders inside the home and has no standalone page.
Set its text and scene options in `params`. On the home page,
`params.show_navigation` controls the first navigation column and defaults to
`true`, with or without home art. The art bundle's `styles` and `scripts` select
resources, published as fingerprinted external files. The wind bundle uses the
`home-art/wind/scene` shortcode; sites can override its HTML in `layouts/_shortcodes/`.
Keep internal pages in `content/_res/`; its shared `_index.md` hides this branch
from navigation and discovery. Its Offline and prefetch diagnostic
pages publish under `_res/`. Delete optional pages you do not need. SW `enable`
requires a published HTML offline page for each enabled language.
Run in PowerShell from the site root (Windows x64):

```powershell
.\.agents\skills\swaw-banyan\swban.cmd base/hugo server -D --disableFastRender --port 13241  #Start the preview
```

The entry prepares Node/npm, Git, Go and Hugo as needed. It reuses compatible
tools or downloads missing tools. Bun remains an optional tool under `base/bun`.
GitHub CLI is prepared when you use `base/gh`.
`base/uv/python` prepares an isolated Python environment; `base/uv tool run` runs
Python CLI packages. See [Python tools](.agents/skills/swaw-banyan/references/python.md).
Cloudflare's cf and Wrangler are available under `deploy/cloudflare/`.
See [Cloudflare tools](.agents/skills/swaw-banyan/references/cloudflare.md).
Tencent Cloud's tccli is available under `deploy/tencent/cli`, with automatic
uv/Python preparation. See [Tencent Cloud tools](.agents/skills/swaw-banyan/references/tencent.md).
`swban deploy/auth/setup` opens the shared Cloudflare and Tencent Cloud authorization page.
Open <http://127.0.0.1:13241/>.

To add Banyan to an existing site or update its theme separately, see
[Getting started](https://swaw.com/zh/p/getting-started/).
For builds and checks, see
[Local development](https://swaw.com/zh/p/local-development/).

## Documentation

The guides are currently in Chinese.

- [Site configuration](https://swaw.com/zh/p/site-configuration/)
- [Lists and products](https://swaw.com/zh/p/collection-lists/)
- [Layout slots](https://swaw.com/zh/p/layout-slots/)
- [Delivery and caching](https://swaw.com/zh/p/delivery/)
- [Security and CSP](https://swaw.com/zh/p/security-csp/)
- [Discovery and source links](https://swaw.com/zh/p/discovery/)
- [Web app manifest and icons](https://swaw.com/zh/p/web-app/)
- [Development and release guides](https://swaw.com/zh/d/banyan/docs/development/)

## License

[MIT License](LICENSE)  
Copyright (c) 2026 WY Swaw LLC (https://swaw.com, https://github.com/SwawHQ)
