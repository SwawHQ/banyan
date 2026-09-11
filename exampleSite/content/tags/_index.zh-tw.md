---
root_nav: true
title: 內容 - 分類
linkTitle: 內容 - 分類
weight: 20
browser_title: Banyan 範例站內容主題
description: 按主題瀏覽範例內容。
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
