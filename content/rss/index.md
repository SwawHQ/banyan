---
title: RSS Subscription
description: Subscribe to new articles with an RSS reader.
date: 2026-09-08
url: rss/ #Keep this route when renaming the content directory.
layout: page-article-norss #Render Markdown without RSS inclusion.
weight: 90

params:
  icon: rss
  slots: [breadcrumb] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---

Add a subscription address to your RSS reader to receive article updates.

## All articles {#all-articles}

{{< rss-link >}}

## Category subscriptions {#by-section}

For a **category** or **subcategory** listing page that provides RSS, remove `?` or `#` and everything after it, if present. Append `index.xml` after the final `/` in the category path to obtain the feed URL. Example (assuming a `category1/category2/` category path exists):

```text
Category page: {{< site-root >}}category1/category2/
Category page: {{< site-root >}}category1/category2/#...
Category page: {{< site-root >}}category1/category2/?...

Feed URL: {{< site-root >}}category1/category2/index.xml
```

> Individual article pages do not provide RSS feeds.\
> Parent category feeds also include articles from their subcategories.\
> The site owner may disable RSS for some categories.
