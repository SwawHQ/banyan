---
title: 发布 · 站点发现与来源链接
date: 2026-11-06
lastmod: 2026-11-15
url: p/discovery/
description: 控制 sitemap 收录，了解 llms.txt，并添加文章来源和外部发布链接。
---

## 结构化数据

页面使用 JSON-LD 向机器提供结构化数据。Schema.org 定义类型和字段：
站点使用 `WebSite`，文章使用 `BlogPosting`，面包屑使用 `BreadcrumbList`，集合列表使用 `ItemList`。
这些数据由模板随 HTML 生成。概念见[项目术语表](/zh/p/glossary/#结构化数据)，
文章和面包屑数据的装配见[页面区域与布局](/zh/p/layout-slots/)。

## RSS 订阅

在 `content/rss/index*.md` 中维护订阅说明，正文调用 `{{</* rss-link */>}}` 显示当前语言的订阅地址。

使用前在 `[outputs].home` 启用 RSS；删除 RSS 说明页不会关闭订阅输出。

RSS 页面按“全部文章 + 分类订阅”组织：全站地址使用 `rss-link` 读取实际输出；分类部分说明各栏目订阅地址。示例通过 `site-root` 输出当前语言首页的绝对网址，自动保留部署子路径和语言前缀，其余分类路径以代码展示。分类是否提供 RSS 由其输出配置决定；普通文章默认不单独发布 RSS。

栏目 RSS 与目录计数、汇总列表共用递归成员，包含子栏目的真实文章和 `_map.toml` 引用。
同一正文在一个 feed 中只出现一次，链接始终指向原文。RSS 只收录布局为 `page-article-rss` 的文章。首页 RSS 使用当前语言可列出的文章；
产品栏目使用相同规则；不同栏目的 RSS 可以收录同一篇文章。输出由 `[outputs]` 控制，条数使用 `[services.rss].limit`。

## Sitemap

Sitemap 收录已渲染且可索引的 HTML 页面，包括 `build.list: local` 和
`build.list: never` 页面。页面 front matter 可用以下设置排除收录：

```yaml
sitemap:
  disable: true
```

在 section bundle 使用 `cascade.sitemap.disable: true`，可排除该目录和后代。
该设置不阻止 HTML 渲染或搜索引擎索引。
`params.robots: noindex`、`params.robots: none`、翻译占位页和 404 页自动排除，
也不会进入其他页面的替代语言链接。

构建后运行 `swban check/sitemap <build>`，并查看产物中的 `sitemap.xml`。使用本地预览时，按[开始使用](/zh/p/getting-started/#本地预览)保留 `--disableFastRender`，避免快速重建保留旧输出。

## Agent 索引

`llms.txt` 位于对应语言首页的路径下，并链接其他语言的索引。
默认语言首页位于根路径时，根 `/llms.txt` 就是该语言的内容目录；
不再额外生成 `/<default-language>/llms.txt` 副本。

各语言索引与对应 sitemap 共用收录规则，按页面所在栏目及其祖先标题分组，
直接链接规范 HTML 页面。首页、独立页面、栏目和分类入口也保留为链接，
每组内每个地址只列一次。页面条目使用已有标题和 `description`；没有描述时只列链接。
`_map.toml` 只增加目录入口，不生成页面；同一文章可在 LLMS 的所属栏目和引用栏目中分别列出，sitemap 不增加重复条目。
新增、删除或调整收录设置后，构建自动更新索引，无需另写页面清单。
站点说明配置见[站点配置](/zh/p/site-configuration/)。

`swban check/llms <build>` 比较各语言索引与 sitemap，检查漏项、多项、
组内重复地址和失效链接。检查发布结果使用完整构建；预览重建使用 `--disableFastRender`。

`llms.txt` 提供可选的内容目录，不定义抓取权限。是否生成由站点根配置的
`outputs.home` 决定；从该数组移除 `LLMS` 即可停用，不影响 `robots.txt`。
站点通过 `assets/site/robots.txt.tmpl` 维护爬虫规则；`enableRobotsTXT` 控制是否生成 `robots.txt`。模板中直接写 `User-agent`、`Allow` 或 `Disallow`，并保留 sitemap 地址。

## 分享图片

在页面 front matter 的 `params` 中设置 `share_image`：

```yaml
params:
  share_image: cover.jpg
```

相对路径读取声明页面 bundle 中的文件。可处理的位图会缩放到
`1200 × 630` 范围内，转为 JPEG，并以带哈希的地址发布；其他文件直接发布为带哈希的资源。
也可使用站点根路径（如 `/images/share.jpg`）或绝对 `https://` URL，直接用于分享卡片。

未声明时，按当前页、最近祖先到最远祖先、当前语言首页的顺序查找。
首页的声明可提供全站默认图片；继承图片时仍从声明页的 bundle 读取。
`share_image: false` 关闭该页的分享图片，并停止继续查找祖先默认值。
此字段同时用于 Open Graph 和 Twitter 卡片。

## GitHub 来源

在站点根 `hugo.toml` 中指定内容仓库：

```toml
[params.content_source]
repository = "https://github.com/owner/repo"
branch = "main"
```

此配置用于站点自有内容。页面有 Hugo 源文件且 `params.slots` 包含 `meta` 时，
文章元信息显示 `GitHub` 链接。不需要显示源码链接时，删除 `params.content_source` 配置。
`branch` 默认是 `main`，站点可只填写 `repository`。
来源路径使用 `content/` 下的实际源文件路径。Banyan 的文档与变更记录因此链接到
本仓库的 `content/articles/docs-guide/`、`content/articles/docs-dev/` 和 `content/articles/changelog/`。
链接指向配置的分支；文件尚未推送到该分支时，链接可能返回 404。
页面的站点构建版本在 Powered by 中查看。

## 外部发布链接

无法从本站 URL 推导的发布副本，在对应页面 front matter 中声明：

```yaml
params:
  published_links:
    - label: WeChat
      url: https://example.com/wechat-article
    - label: Xiaohongshu
      url: https://example.com/xiaohongshu-note
    - label: X
      url: https://example.com/x-post
```

每项填写名称和绝对 `https://` URL。GitHub 排在前面，其余链接保留声明顺序。
不同语言分别维护列表，因为它们的发布平台和地址可能不同。
