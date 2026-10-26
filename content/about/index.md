---
date: "2025-10-11T20:10:44+08:00"
title: "About"
# linkTitle: "About" #Replace the navigation label only.
description: "Learn how Banyan organizes content directories and navigation for Hugo sites."
url: about/ #Keep this route when renaming the content directory.
weight: 95
layout: page-article-norss #Render Markdown without RSS inclusion.

params:
  # browser_title: "About this site" #Replace the title before the site name in browser tabs.
  # icon: info #Use a name from assets/site/icons.toml, or {text: "?"}.
  # share_image: false #Stop inherited social preview images for this page.
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---


Banyan is a minimalist Hugo theme with an Explorer-like layout. Ordinary directories organize articles, and shared `_map.toml` files add cross-directory references.

As defined in our `theme.toml`:
- **Name**: banyan
- **Tags**: blog, minimalist
- **Description**: A Explorer-like Hugo theme.

Enjoy using this theme!
