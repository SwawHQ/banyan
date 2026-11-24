---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
layout: page-collection-products-all
params:
  slots: [breadcrumb]
  aggregate: /products
  list_icon_file: product
---
