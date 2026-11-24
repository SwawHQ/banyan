---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
layout: page-collection-wall-all
params:
  slots: [breadcrumb]
  aggregate: /articles
  wall:
    size: {width: 300, height: 125}
    details: title
    scroll: horizontal
---
