---
# Show this direct child of Home in root navigation; weight sets its order.
title: Products - Categories
description: Browse products by category.
weight: 40
layout: page-collection-directory

params:
  # icon: {text: "P"} #Override this entry's default folder icon.
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  # Row icons inherit these defaults; each row's own icon takes priority.
  # list_icon_folder: folder
  list_icon_file: product

# Descendants use these defaults unless their own front matter overrides them.
cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  - target: {kind: section}
    layout: page-collection-products
    params:
      slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
