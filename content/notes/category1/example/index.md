---
title: Example article
# Short list label; omit to use title.
# linkTitle: Short title
# Set lastmod when article content changes; moving files does not change it.
date: "2026-01-02T00:00:00+08:00"
lastmod: "2026-01-02T00:00:00+08:00"
# Keep this URL when moving or renaming the bundle.
url: p/example-product/
description: One article shown in note and product lists.
# The section cascade supplies layout and slots; uncomment only to override.
# layout: page-article-rss

params:
  # Override the browser/tab title without changing the visible heading.
  # browser_title: Browser title
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

  # Product-list values; they do not control directory membership.
  offer:
    amount: 0
    currency: "$"
    value: Publish one article in different list views.
---

This article belongs to the notes directory. The products directory references it with `_map.toml`.

The note lists show article metadata. The product lists use `offer` for the price and value statement. Both link to this page.
