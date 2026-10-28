---
title: تصنيفات المنتجات
description: تصفح المنتجات حسب التصنيف.
weight: 40
layout: page-collection-directory

params:
  slots: [breadcrumb]
  list_icon_file: product

cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta]
  - target: {kind: section}
    layout: page-collection-products
    params:
      slots: [breadcrumb]
---
