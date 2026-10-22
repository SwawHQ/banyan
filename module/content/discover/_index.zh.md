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
