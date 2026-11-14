---
title: 站点发现与来源链接
date: 2026-11-06
lastmod: 2026-11-14
url: p/discovery/
description: 控制 sitemap 收录，了解 llms.txt，并添加文章来源和外部发布链接。
---

## 结构化数据

页面使用 JSON-LD 向机器提供结构化数据。Schema.org 定义类型和字段：
站点使用 `WebSite`，文章使用 `BlogPosting`，面包屑使用 `BreadcrumbList`，集合列表使用 `ItemList`。
这些数据由模板随 HTML 生成。概念见[项目术语表](/zh/p/glossary/#结构化数据)，
文章和面包屑数据的装配见[页面区域与布局](/zh/p/layout-slots/)。

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

预览时使用 `hugo server --disableFastRender` 检查 sitemap 变化，
快速预览可能保留旧输出。自定义 HTML 布局须继承 Banyan 的 `baseof.html`，
由它登记已渲染页面。

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
文章元信息显示 `GitHub` 链接。Module 默认不设置仓库；
`branch` 默认是 `main`，站点可只填写 `repository`。
来源路径使用 `content/` 下的实际源文件路径。Banyan 的文档与变更记录因此链接到
本仓库的 `content/articles/docs/` 和 `content/articles/changelog/`。
链接使用配置的分支，使新页面在首次公开提交前也有稳定地址。
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
