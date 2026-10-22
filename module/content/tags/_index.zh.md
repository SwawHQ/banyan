---
root_nav: true
title: 发现 - 分类
weight: 20
description: 按主题浏览内容。
layout: page-collection
list: directory
slots:
  breadcrumb: true
cascade:
  - target:
      kind: term
    layout: page-collection
    slots:
      breadcrumb: true
banyan_taxonomy:
  mode: tree
  article_weight: 30
  normalize: lower
  article_mode: leaf_paths
  term_rel: tag
  unassigned_term: untagged
  unassigned_label: --untagged--
---
