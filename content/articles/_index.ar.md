---
title: تصنيفات المقالات
description: تصفح المقالات حسب التصنيف.
weight: 40
layout: page-collection-directory

params:
  slots: [breadcrumb]

cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta]
  - target: {kind: section}
    layout: page-collection-directory
    params:
      slots: [breadcrumb]
---
