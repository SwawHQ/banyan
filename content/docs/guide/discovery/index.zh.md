---
title: 站点发现与来源链接
slug: discovery
description: 控制 sitemap 收录，了解 llms.txt，并添加文章来源和外部发布链接。
---

## Sitemap

Sitemap 收录已渲染且可索引的 HTML 页面，包括 `build.list: local` 和
`build.list: never` 页面。页面 front matter 可用以下设置排除收录：

```yaml
sitemap:
  disable: true
```

在 section bundle 使用 `cascade.sitemap.disable: true`，可排除该目录和后代。
该设置不阻止 HTML 渲染或搜索引擎索引。
`robots: noindex`、`robots: none`、翻译占位页和 404 页自动排除，
也不会进入其他页面的替代语言链接。

预览时使用 `hugo server --disableFastRender` 检查 sitemap 变化，
快速预览可能保留旧 XML。自定义 HTML 布局须继承 Banyan 的 `baseof.html`，
由它登记已渲染页面。

## Agent 索引

多语言站点的默认语言位于根路径时，`/llms.txt` 为全局索引。
Banyan 同时发布 `/<default-language>/llms.txt`，路径形式与多语言 sitemap 一致。

各语言索引直接链接规范 HTML 页面，收录语言首页、`/about/`
和 `d` 内容 section 的普通文章。工具页和分类索引不进入精选索引，
无需为每页设置输出开关。站点说明配置见[站点配置](/zh/docs/guide/site-configuration/)。

## GitHub 来源

在站点根 `hugo.toml` 中指定内容仓库：

```toml
[params.content_source]
repository = "https://github.com/owner/repo"
branch = "main"
content_root = "content"
```

当前页面有 Hugo 源文件时，文章元信息显示 `GitHub` 链接。
主题默认不设置仓库。链接使用配置的分支，使新页面在首次公开提交前也有稳定地址。
准确的部署版本在 Powered by 中查看。

## 外部发布链接

无法从本站 URL 推导的发布副本，在对应页面 front matter 中声明：

```yaml
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
