---
title: RSS 订阅
description: 使用 RSS 阅读器订阅文章更新。
date: 2026-09-08
url: rss/ #重命名内容目录时保留此网址。
layout: page-article-norss #显示 Markdown 正文，不作为 RSS 条目。
weight: 90

params:
  icon: rss
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
---

将订阅地址添加到 RSS 阅读器，即可接收文章更新。

## 全部文章 {#all-articles}

{{< rss-link >}}

## 分类订阅 {#by-section}

对提供 RSS 的**分类**或**子分类**列表页面，去掉网址中的 `?`、`#` 及其后的内容（若有），在分类路径末尾的 `/` 后添加 `index.xml`，即为订阅地址。示例（假设存在 `category1/category2/` 分类路径）：

```text
分类页面：{{< site-root >}}category1/category2/
分类页面：{{< site-root >}}category1/category2/#...
分类页面：{{< site-root >}}category1/category2/?...

订阅地址：{{< site-root >}}category1/category2/index.xml
```

> 单篇文章页面不提供 RSS 订阅地址。\
> 父分类的订阅也包含其子分类中的文章。\
> 站长可能关闭某些分类的 RSS 订阅。