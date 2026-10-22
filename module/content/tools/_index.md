---
root_nav: true
title: Tools - Categories
description: Browse tools by price or origin.
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
