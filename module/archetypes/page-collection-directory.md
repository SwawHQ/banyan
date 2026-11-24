---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
layout: page-collection-directory
params:
  slots: [breadcrumb]
  default_sort: name-asc

cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta]
  - target: {kind: section}
    layout: page-collection-directory
    params:
      slots: [breadcrumb]
---
