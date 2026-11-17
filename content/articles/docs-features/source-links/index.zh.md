---
title: 来源：怎么添加文章链接？
date: 2026-11-17
lastmod: 2026-11-17
url: p/source-links/
description: 在文章元信息中显示 GitHub 源文件和其他平台的发布链接。
---

先在文章的 `params.slots` 中保留 `meta`，以显示文章元信息。

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
本仓库的 `content/articles/docs-*/` 和 `content/articles/changelog/`。
链接指向配置的分支；文件尚未推送到该分支时，链接可能返回 404。
页面的站点构建版本在 Powered by 中查看。

## 外部发布链接

文章另有发布副本时，在该文章的页面元数据中填写链接：

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

## 检查结果

运行 `swban dev`，打开文章的目录与信息区域，依次访问 GitHub 和外部发布链接，确认指向当前文章。
