---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
layout: page-collection-directory-all
params:
  slots: [breadcrumb]
  aggregate: /articles
  # time_range: {start: "2025-01-01", end: "2026-01-01"}
---
