---
root_nav: true
title: 工具 - 分类
description: 按价格或来源浏览工具。
weight: 40
layout: page-collection
list: directory
list_icon_file: product
outputs:
  - HTML
  - RSS
slots:
  breadcrumb: true
cascade:
  - target:
      kind: page
    layout: page-article
    slots: {breadcrumb: true, meta: true}
  - target:
      kind: section
    layout: page-collection
    list: products
    outputs: [HTML, RSS]
    slots: {breadcrumb: true}
---
