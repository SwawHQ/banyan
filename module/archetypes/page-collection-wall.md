---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
layout: page-collection-wall
params:
  slots: [breadcrumb]
  wall:
    size: {width: 300, height: 125}
    details: title
    scroll: horizontal
---
