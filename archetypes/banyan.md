---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
# The theme renders the sole article H1 from title; start body headings at ##.
# Short label in lists and navigation; omit to use title.
# linkTitle: "Short title"
# Set lastmod when article content changes; moving files does not change it.
date: {{ .Date }}
lastmod: {{ .Date }}

draft: true
# Keep this URL when moving or renaming the article bundle.
url: "p/{{ .File.ContentBaseName | urlize }}/"
description: ""

# The section cascade supplies layout; uncomment only to override.
# layout: page-article-rss

# params:
  # Override the browser/tab title without changing the visible heading.
  # browser_title: "Browser title"
  # slots: [breadcrumb, meta] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.

  # List icon; omit to use the listing's default. Choose one form.
  # icon: file
  # icon: {text: "N"}
  # icon: {image: "site/favicon.link.svg", monochrome: true}

  # Omit to inherit a share image; false stops inheritance. Local files belong in this bundle.
  # share_image: cover.jpg
  # share_image: false

  # Links to other published copies. The source GitHub link uses hugo.toml.
  # published_links:
  #   - label: Other publication
  #     url: https://example.com/article

  # Optional product-list values; they do not control directory membership.
  # offer:
  #   amount: 0
  #   currency: "$"
  #   value: Describe the product's value.

# Keep the article in a leaf bundle: category/article/index.md.
# Other directories reference its content path in _map.toml.
---
