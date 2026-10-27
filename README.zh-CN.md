# Banyan

[English](README.md) · 简体中文

一个网站模板（Hugo 主题），用于对资源、文章做分类、提供米勒列导航。


[演示](https://banyan.swaw.com/) ·
[文档](https://swaw.com/zh/d/banyan/docs/) ·
[变更记录](https://swaw.com/d/banyan/changelog/)


**1.** 米勒列导航

**2.** 多层、多维分类

**3.** 文章、产品列表视图

**4.** 配套 Agent Skill，自动部署腾讯 EdgeOne pages、Cloudflare pages，自动日常运维

**5.** 纯静态部署、资源指纹与 CDN 缓存

**6.** 多语言、主题切换、自定义外观

**7.** PWA、SW 缓存、页面预取

**8.** 自动生成 CSP 与 SRI

**9.** RSS、社交元数据、sitemap、robots.txt、llms.txt




仓库根目录维护文章（`articles`、`articles-all`）和产品（`products`、`products-all`）四个示例入口，共用一篇文章，并提供可选的设置和说明页面。
Powered by 和预取诊断页面也由站点根 `content/` 维护。Module 只提供布局、脚本和样式，不提供站点内容。

## 开始使用

克隆或解压完整仓库，以根参考站点开始新站点。
文章模板由站点根 `archetypes/banyan.md` 维护。
Front matter 中，`title`、`url`、`layout` 等 Hugo 原生字段保留在顶层。
自定义页面字段放在 `params` 下，继承默认值放在 `cascade.params` 下。
`page-article-rss` 可作为 RSS 条目，`page-article-norss` 用于其他 Markdown 页面。
`meta` 区域统一启用文章元信息、章节目录和 BlogPosting。
集合布局直接决定字段和行为：`page-collection` 只显示名称，
`page-collection-directory` 显示目录信息，`page-collection-products` 显示产品信息。
后两者的 `-all` 布局通过 `params.aggregate` 指定汇总来源栏目。
栏目默认输出 HTML 和 RSS；不需要订阅源时设置 `outputs: [HTML]`。
语言和外观设置使用 `_index.md`，布局分别为 `page-collection-language`、
`page-collection-appearance`，只输出 HTML。
保留根 `assets/site/`，再换成自己的图标，
并检查 `assets/site/manifest.webmanifest.tmpl` 和 `assets/site/robots.txt.tmpl`。
这些模板由站点维护；Module 和传统主题目录不包含站点图标或这些模板。
保留 `assets/site/` 中的完整配置和已启用语言的 `assets/i18n/` 界面字典；主题不提供这些文件。
保留项目中从 `assets/i18n` 到 `i18n` 的 Hugo 挂载。
增删语言时，同步调整 `hugo.toml`、界面字典和所需的内容译文。
第一列默认显示首页和 `content/` 中已发布的直属页面、栏目。
各语言的默认描述由对应首页的 `description` 提供。
内部页面统一放在 `content/_res/`，共用的 `_index.md` 将此分支排除在导航和站点发现之外。
其中的离线页和预取诊断页统一发布到 `_res/` 路径；可删除不需要的可选页面。
SW 为 `enable` 时，每种已启用语言都必须发布 HTML 离线页。
在站点根目录用 PowerShell 执行（Windows x64）：

```powershell
.\.agents\skills\swaw-banyan\swban.cmd base/hugo server -D --disableFastRender --port 13241  #启动预览
```

入口会按需准备 Node/npm、Git、Go 和 Hugo：优先复用兼容工具，缺少时自动下载。
GitHub CLI 在使用 `base/gh` 时准备。
`base/uv/python` 按需准备隔离的 Python 环境；`base/uv tool run` 运行 Python CLI。
使用方法见 [Python 工具](.agents/skills/swaw-banyan/references/python.md)。
`deploy/cloudflare/` 提供 cf 和 Wrangler，按需准备固定版本。
使用方法见 [Cloudflare 工具](.agents/skills/swaw-banyan/references/cloudflare.md)。
`deploy/tencent/cli` 提供 tccli，自动准备 uv/Python 和独立工具环境。
使用方法见 [腾讯云工具](.agents/skills/swaw-banyan/references/tencent.md)。
`swban deploy/auth/setup` 打开 Cloudflare 和腾讯云共用的授权页。
打开 <http://127.0.0.1:13241/> 查看站点。

已有站点接入或单独升级主题，见[开始使用](https://swaw.com/zh/p/getting-started/)；
构建和检查，见[本地开发](https://swaw.com/zh/p/local-development/)。


## 文档

指南目前以中文提供。

- [站点配置](https://swaw.com/zh/p/site-configuration/)
- [列表与产品](https://swaw.com/zh/p/collection-lists/)
- [页面区域](https://swaw.com/zh/p/layout-slots/)
- [交付与缓存](https://swaw.com/zh/p/delivery/)
- [安全策略与 CSP](https://swaw.com/zh/p/security-csp/)
- [站点发现与来源链接](https://swaw.com/zh/p/discovery/)
- [Web App Manifest 与图标](https://swaw.com/zh/p/web-app/)
- [开发与发布指南](https://swaw.com/zh/d/banyan/docs/development/)

## 许可证

[MIT 许可证](LICENSE)  
Copyright (c) 2026 WY Swaw LLC (https://swaw.com, https://github.com/SwawHQ)

