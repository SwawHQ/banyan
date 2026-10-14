---
title: 文档
description: Banyan 使用配置、源码协议与检查方法。
root_nav: true
weight: 5
icon: folder
layout: page-collection
list: directory
outputs: [HTML]
slots:
  breadcrumb: true
cascade:
  - target:
      kind: page
    layout: page-article
    outputs: [HTML]
    slots:
      breadcrumb: true
      meta: true
  - target:
      kind: section
    layout: page-collection
    list: directory
    outputs: [HTML]
    slots:
      breadcrumb: true
---

使用指南说明如何配置主题。开发资料记录源码协议和检查方法。
