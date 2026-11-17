---
title: 04 怎么选择列表显示方式？
date: 2026-11-06
lastmod: 2026-11-17
url: p/collection-lists/
description: 选择普通列表或名称列表，按需要进入汇总和产品教程。
---

## 修改栏目布局

打开目标栏目的 `_index*.md`，修改 `layout`。保留页面标题和已有参数。

| 想显示什么 | layout 或教程 |
| --- | --- |
| 名称、更新时间、数量或大小 | `page-collection-directory` |
| 只显示名称和图标 | `page-collection-directory-name-only` |
| 汇总下级文章 | [文章汇总](/zh/p/aggregate-list/) |
| 产品名称和价格 | [产品展示](/zh/p/products/) |
| 图片封面 | [图片墙](/zh/p/image-wall/) |

## 只显示名称

例如，在已有栏目中修改：

```yaml
layout: page-collection-directory-name-only
```

名称列表显示直属子栏目、文章和引用，默认按名称升序排列。点击名称列头可切换升序和降序。普通文章沿用文章布局。

## 检查结果

运行 `swban dev`，打开栏目，确认条目仍可访问且列内容已改变。栏目正文显示在列表之后。

后续设置：[默认排序](/zh/p/list-sorting/) · [文章日期](/zh/p/article-dates/) · [条目图标](/zh/p/item-icons/)。
