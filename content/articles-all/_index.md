---
# Show this direct child of Home in root navigation; weight sets its order.
title: Articles - All
description: All articles in one list.
weight: 10
layout: page-collection-directory-all

params:
  # icon: {text: "A"} #Override this entry's default folder icon.
  # Aggregate reads all articles and _map.toml references under this section, without duplicates.
  aggregate: /articles
  # Optional Lastmod range: include start, exclude end. See the installation guide for child sections.
  # time_range: {start: "2000-01-01", end: "2005-02-01"}
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
