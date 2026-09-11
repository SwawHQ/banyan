---
root_nav: true
title: Content - Categories
linkTitle: Content - Categories
weight: 20
browser_title: Content Topics in the Banyan Example Site
description: Browse example content by topic.
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
