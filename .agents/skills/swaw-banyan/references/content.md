# Content and layouts

Read this when creating pages or changing their layout, RSS participation or
collection membership. Site configuration is covered in
[Site configuration](site-configuration.md).

## Home page

Create `content/_index.md` for each language's home. This example uses an art
bundle; omit the shortcode for a home without art:

```markdown
---
title: My site
description: Describe this site.
layout: page-home
params:
  show_navigation: true
---

{{< home-art "/_res/home-art/wind" >}}
```

The home page's `params.show_navigation` controls the first navigation column
and defaults to `true`, including homes without a `home-art` shortcode.

## Image walls

For an image-wall home, use this front matter and omit the art shortcode:

```yaml
layout: page-collection-wall-all
params:
  aggregate: /articles
  wall:
    size:
      width: auto
      height: 200
    details: title
    scroll: horizontal
```

For a mixed section, use `page-collection-wall`, omit `aggregate`, and set
`params.slots: [breadcrumb]`. It shows direct child sections, articles and references.
Section covers open the section; titles or dots open the shared details popover
with its description and article count. Section covers use bundle `cover.*`,
falling back to an independent `description` at body text size. Without a
distinct description, missing covers use the centered site `favicon.link.svg`,
then `favicon.ico`; absence of both is a build error. Ancestor columns stay compact.
Use a section-only cascade to apply the layout, wall options and breadcrumb slot
to descendants; articles keep their separate cover options.

Size specifies target image dimensions
in CSS pixels, excluding titles and gaps. Two numbers set a fixed crop ratio;
`width: auto` preserves the source ratio at equal height, and `height: auto`
preserves it at equal width. Actual dimensions adapt to available space.
Details are `title`, `overlay` (image dots), or `overlay-hover` (always visible
on touch screens). Scrolling is `horizontal` or `vertical`.
Put `cover.*` in an article bundle, or set article `params.wall.cover` to a
bundle resource name. Optional `params.wall.alt` supplies image text;
`params.wall.kind: video` adds a video marker and still links to the article.
Restore `page-home`, remove `aggregate` and `wall`, and restore the art shortcode
to switch back. The reference site retains both art bundles.

For home navigation and art bundles, read [Home art](home-art.md).

## Collections and article layouts

Collection layouts bind their fields, sorting and controls. Use:

| Layout | Lists |
| --- | --- |
| `page-collection-directory-name-only` | Direct entries, names only |
| `page-collection-directory` | Direct entries with date and count |
| `page-collection-directory-all` | Articles under `params.aggregate`, with date and size; optional time ranges form a directory tree |
| `page-collection-products` | Direct entries with update time and price |
| `page-collection-products-all` | All articles under `params.aggregate`, with update time and price |

The directory and product `-all` layouts use `params.aggregate` to select a source section.
Choose your own directory names. For example, create `content/articles/_index.md`:

```markdown
---
title: Articles - Categories
description: Browse articles by topic.
layout: page-collection-directory
params:
  slots: [breadcrumb]
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
```

Use `params.slots` to list enabled regions. The order does not change the layout.
`breadcrumb` enables breadcrumb navigation. `meta` enables article metadata, chapters
and article structured data (`BlogPosting`, encoded as JSON-LD) on regular article pages. Omit `params.slots` to inherit it;
use `params.slots: []` to disable them.

Create `content/articles/sample/_index.md` for a nested directory. Its layouts come
from the site's `articles` root:

```markdown
---
title: Sample
description: Sample articles.
---
```

### Articles and RSS

Use `page-article-rss` for articles that may appear in RSS. Use
`page-article-norss` for Markdown pages that must stay out of RSS. Both layouts keep
the same article features. Directory and aggregate feeds apply the same article
selection rule.

Sections default to HTML and RSS outputs. Set
`outputs: [HTML]` to disable a section's feed. Its articles can still appear
in the site feed when they use `page-article-rss`.

With the site-owned `archetypes/banyan.md`, create an article using:

```text
swban base/hugo new content --kind banyan articles/my-post/index.md  #Create an article
```

For a manual example, create `content/articles/sample/alpha/index.md`:

```markdown
---
title: Alpha
url: p/alpha/
description: An independent Alpha article.
date: 2026-01-01
params:
  share_image: false
  offer:
    amount: 0
    currency: "$"
    version: "1.0.0"
---

Independent article content.
```

Keep the article's `url` when moving its source. Use a language-relative path
without a leading slash; Hugo adds the current language prefix. Information
pages keep their own URLs. Collections and settings use `_index.md` and their
content directory paths; omit `url` and `slug`.

### References

To list the article in another directory, create `content/articles/related/_index.md`
with its title and description. Put one shared `_map.toml` beside it:

```toml
refs = ["/articles/sample/alpha"]
```

Targets are logical content paths. Each language uses its own target translation.
The reference takes its title and metadata from the article and adds no second
page. A reference directory and its ancestors use `build.list: always` or `local`.
Resource publishing follows Hugo's `build.publishResources` setting, including
`_map.toml`.

### Aggregates and time ranges

Create `content/articles-all/_index.md` to list all articles under `articles`:

```markdown
---
title: Articles - All
description: All articles.
layout: page-collection-directory-all
params:
  aggregate: /articles
  slots: [breadcrumb]
---
```

To divide this aggregate by time, keep articles in their source directories and
create child sections under `content/articles-all/`. Add this cascade to the
aggregate root so child sections use the same layout and source:

```yaml
cascade:
  - target: {kind: section}
    layout: page-collection-directory-all
    params:
      aggregate: /articles
      slots: [breadcrumb]
```

Set each child section's range in its `_index.md`. For example,
`content/articles-all/2000-2005/_index.md`:

```markdown
---
title: 2000–2005
params:
  time_range:
    start: "2000-01-01"
    end: "2005-02-01"
---
```

The start is included and the end is excluded. Dates and times use the site's
`timeZone` unless they specify an offset; values can include seconds, such as
`2000-01-01T12:30:15+08:00`. Selection uses Hugo's `Lastmod`, including the
`[frontmatter] lastmod` setting.

Create further child sections in the same way. Each list shows its child
sections and the articles not assigned to them. Folder counts include all
articles in their range; direct articles show their sizes. The section's RSS
includes the whole range, including articles in child sections. Article links
retain this browsing path through `#from`; article URLs stay unchanged.

## Product collections

Products use the same directories and `_map.toml` references as articles.
Create a product root with `layout: page-collection-directory`. Reuse the
article root's cascade above, but set the section layout to
`page-collection-products`; keep page layout `page-article-rss`.
Set `params.list_icon_file: product` on the product root.

Product lists show `Lastmod` as update time and sort newest first. The article's
`params.offer` supplies its price; `offer.version` can remain as metadata.
The same article can occur in several directories. For an aggregate, use
`layout: page-collection-products-all`, `params.aggregate: /products` and
`params.list_icon_file: product`. It lists each article once. Use
`outputs: [HTML]` if this aggregate should not publish a feed.

Add translated content files for each enabled language. Directory references use
one `_map.toml` across languages. The Module provides no pages. Copy optional
settings and information pages from the reference root when needed.

For language and appearance pages, see [Settings pages](site-configuration.md#language-and-appearance-pages).
For Powered by and offline page behavior, see [Status and diagnostics](diagnostics.md).
