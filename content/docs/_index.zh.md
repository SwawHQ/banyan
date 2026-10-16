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

初次使用请从[开始使用](/zh/docs/guide/getting-started/)进入。
使用指南说明如何配置主题；开发资料记录本地预览、源码协议、检查和发布流程。
