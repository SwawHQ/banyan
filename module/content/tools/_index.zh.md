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
slots:
  breadcrumb: true
cascade:
  - target:
      kind: term
    layout: page-collection
    list: products
    slots:
      breadcrumb: true
banyan_taxonomy:
  mode: flat
  article_weight: 40
  normalize: identity
  article_mode: all
  require_term_bundles: false
---
