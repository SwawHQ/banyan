---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
layout: page-collection-directory-name-only
params:
  slots: [breadcrumb]
  default_sort: name-asc
---
