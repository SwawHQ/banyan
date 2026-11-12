---
title: تصنيفات المقالات
description: تصفح المقالات حسب التصنيف.
weight: 40
layout: page-collection-directory

params:
  # Use with layout: page-collection-wall; uncomment params.wall to enable the wall.
  # wall:
  #   size: {width: 300, height: 125}
  #   details: title
  #   scroll: horizontal
  slots: [breadcrumb]

cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta]
  - target: {kind: section}
    layout: page-collection-directory
    params:
      # Use with layout: page-collection-wall; uncomment params.wall to enable the wall.
      # wall:
      #   size: {width: 300, height: 125}
      #   details: title
      #   scroll: horizontal
      slots: [breadcrumb]
---
