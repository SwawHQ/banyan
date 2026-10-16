# Banyan

English · [简体中文](README.zh-CN.md)

A website template (Hugo theme) for browsing resources and articles by category,
with Miller column navigation.

[Demo](https://banyan.swaw.com/) ·
[Documentation](https://banyan.swaw.com/zh/docs) ·
[Changelog](content/changelog/_index.md)

**1.** Miller column navigation

**2.** Multi-level, multi-dimensional classification

**3.** Article and tool list views

**4.** Companion Agent Skill

**5.** Static deployment, asset fingerprints, and CDN caching

**6.** Multiple languages, theme switching, and custom appearance

**7.** PWA, Service Worker caching, and page prefetch

**8.** Automatic CSP and SRI generation

**9.** RSS, social metadata, sitemap, robots.txt, and llms.txt

## Get started

Download and extract this repository. Run in PowerShell from its root
(Windows x64):

```powershell
.\.agents\skills\swaw-banyan\swban.cmd git.ensure                                       #Prepare Git and the JS runtime
.\.agents\skills\swaw-banyan\swban.cmd go.ensure                                        #Prepare Go
.\.agents\skills\swaw-banyan\swban.cmd hugo.ensure                                      #Prepare Hugo
.\.agents\skills\swaw-banyan\swban.cmd hugo server -D --disableFastRender --port 13241  #Start the preview
```

The preparation commands reuse compatible tools or download missing tools.
Open <http://127.0.0.1:13241/>. For later previews, run only the last command.

To install Banyan in your own site, see
[Getting started](content/docs/guide/getting-started/index.zh.md).
For builds and checks, see
[Local development](content/docs/development/local-development/index.zh.md).

## Documentation

The guides are currently in Chinese.

- [Site configuration](content/docs/guide/site-configuration/index.zh.md)
- [Lists and taxonomies](content/docs/guide/collection-lists/index.zh.md)
- [Layout slots](content/docs/guide/layout-slots/index.zh.md)
- [Delivery and caching](content/docs/guide/delivery/index.zh.md)
- [Security and CSP](content/docs/guide/security-csp/index.zh.md)
- [Discovery and source links](content/docs/guide/discovery/index.zh.md)
- [Web app manifest and icons](content/docs/guide/web-app/index.zh.md)
- [Development and release guides](content/docs/development/_index.zh.md)

## License

[MIT License](LICENSE)  
Copyright (c) 2026 WY Swaw LLC  https://swaw.com
