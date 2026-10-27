---
# Show this direct child of Home in root navigation; weight sets its order.
title: Articles - Categories
description: Browse articles by category.
weight: 20
layout: page-collection-directory

params:
  # This entry uses the default folder icon. Set one value to replace it.
  # icon: folder
  # icon: {text: "A"}
  # icon: {image: "site/icon-192.png", monochrome: true}
  # Row icons inherit these defaults; each row's own icon takes priority.
  # list_icon_folder: folder
  # list_icon_file: file
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.

# Descendants use these defaults unless their own front matter overrides them.
cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
  - target: {kind: section}
    layout: page-collection-directory
    params:
      slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
