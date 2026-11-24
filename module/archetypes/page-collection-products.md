---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
layout: page-collection-products
params:
  slots: [breadcrumb]
  list_icon_file: product
  # Set params.offer on each product article (amount, currency and optional version).

cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta]
  - target: {kind: section}
    layout: page-collection-products
    params:
      slots: [breadcrumb]
---
