---
root_nav: true
title: Discover - Categories
weight: 20
description: Browse content by topic.
layout: page-collection
list: directory
slots:
  breadcrumb: true
cascade:
  - target:
      kind: page
    layout: page-article
    slots:
      breadcrumb: true
      meta: true
  - target:
      kind: section
    layout: page-collection
    list: directory
    slots:
      breadcrumb: true
---
