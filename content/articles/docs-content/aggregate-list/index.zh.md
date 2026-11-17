---
title: 03 怎么汇总下级文章？
date: 2026-11-17
lastmod: 2026-11-17
url: p/aggregate-list/
description: 建立独立汇总入口，显示指定栏目及其下级文章。
---

## 创建汇总入口

1. 创建 `content/notes-all/_index.zh.md`。
2. 填写以下配置，将 `/articles` 改为需要汇总的普通栏目的内容路径。

```yaml
---
title: 全部笔记
layout: page-collection-directory-all
params:
  aggregate: /articles
  slots: [breadcrumb]
---
```

汇总列表收录来源栏目及其下级文章和引用，同一篇文章显示一次。其他语言在相同目录中维护对应的 `_index*.md`。

## 检查结果

运行 `swban dev`，从根导航进入“全部笔记”，确认下级文章和引用均已列出，点击条目可打开原文。默认顺序见[设置排序](/zh/p/list-sorting/)，封面展示见[汇总图片墙](/zh/p/home-wall/)。
