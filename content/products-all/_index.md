---
# Show this direct child of Home in root navigation; weight sets its order.
title: Products - All
description: All referenced products in one list.
weight: 30
layout: page-collection-products-all

params:
  # icon: {text: "P"} #Override this entry's default folder icon.
  # Row icons inherit these defaults; each row's own icon takes priority.
  # list_icon_folder: folder
  list_icon_file: product
  # Aggregate reads all articles and _map.toml references under this section, without duplicates.
  aggregate: /products
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
