---
title: RSS：怎么提供文章订阅？
date: 2026-11-17
lastmod: 2026-11-17
url: p/rss-subscriptions/
description: 启用全站和栏目订阅，选择订阅中的文章。
---

## 启用订阅输出

编辑 `hugo.toml` 中已有的 `[outputs]`，为首页和栏目保留 `RSS`。例如：

```toml
[outputs]
page = ["HTML"]
section = ["HTML", "RSS"]
home = ["HTML", "RSS", "LLMS"]
```

保留本站使用的其他输出。单个栏目已声明 `outputs` 时，在该栏目的 `_index*.md` 中加入 `RSS`；设为 `outputs: [HTML]` 可关闭该栏目的订阅。

## 选择文章

使用 `layout: page-article-rss` 的文章可进入订阅。关于页等说明页面使用 `page-article-norss`。参考站已为文章栏目设置布局继承。

栏目订阅包含下级文章和栏目文章引用，同一篇正文在同一订阅中出现一次。首页订阅使用当前语言可列出的文章。修改条数时，在 `hugo.toml` 的 `[services.rss]` 中设置 `limit`。

## 提供订阅入口

编辑各语言的 `content/rss/index*.md`，在正文使用以下短代码显示当前语言的全站订阅地址：

```text
{{</* rss-link */>}}
```

栏目订阅地址为栏目网址加 `index.xml`，例如 `/zh/articles/index.xml`。删除订阅说明页后，订阅输出仍由上述配置控制。

## 检查结果

运行 `swban build`，打开订阅地址，确认文章标题和链接正确。将地址加入 RSS 阅读器，检查是否出现预期文章。搜索使用 `source: rss` 时，搜索范围也会随 RSS 条目和条数限制变化，见[搜索范围](/zh/p/search-scope/)。
