---
title: Documentation
description: Banyan configuration guides and development reference.
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

The documentation is currently available in Chinese. [Read the documentation](/zh/docs/).
