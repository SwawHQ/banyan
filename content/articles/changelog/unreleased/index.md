---
title: Unreleased
url: p/unreleased/
description: Main features, requirements and known limitations of the first Banyan release.
date: 2026-11-06
lastmod: 2026-11-18
---

The first release is in preparation. This page describes its scope. After the release tags are available, follow [Getting started (Chinese)](/zh/p/getting-started/) to install it.

## Main features

- `swban dev` starts a development server with drafts, indexes search after the first render, and writes to Hugo’s `publishDir` (default: `public/`), retaining output on exit. `dev/lan` allows LAN previews; `dev/pagefind.off` skips indexing. Extra arguments pass to Hugo. Startup logs show the commands and preserve tool output. After indexing, single-host servers show the access URL again. Restart the server to update search indexes.

- A dedicated search page searches the current language as you type. Search terms use `#q=` and are not sent with page requests. Results appear with article-width results and bold titles. Each result is a full clickable row with the theme hover and keyboard focus styles. Search pages support RSS entries, HTML file globs or directory arrays, with existing HTML selectors to select content and no Pagefind-specific attributes. The root command launcher supports `swban build` to generate the site and Pagefind index.
- Builds reject source directories and custom mount sources as output destinations. Sites without search pages or RSS entries do not prepare Pagefind. Empty RSS builds succeed, missing language indexes show no results, and search excerpts display escaped characters correctly.

- A Hugo Module supplies layouts, scripts and styles. The companion `swaw-banyan` Agent Skill supplies local tools, build checks and version maintenance. Browser checks support deployment subdirectories and default-language subdirectories; SW disable checks use the actual deployment scope.
- Sections and article references organize content across categories while keeping one published URL per article. Aggregate lists and section RSS feeds are supported. Shared references also work in sections with only a non-default-language index.
- Directory lists, name lists, product lists and image walls present content. Breadcrumb columns retain the article's browsing source and support independent sorting. Sections can configure the default sort field and direction; child sections do not inherit the parent sort. Browsers with native render blocking can wait for breadcrumb data before showing the first frame, reducing flicker during navigation. Failed loads release the wait within a bounded time.
- Multiple languages, right-to-left layouts, light and dark appearance, custom palettes and home art bundles are supported. The reference site includes English, Simplified Chinese and Arabic.
- Web App Manifest, optional SW caching and offline pages, page prefetch and native prerender are supported. Manifest URLs and SW scope follow the deployment subdirectory; SVG favicons accept intrinsic dimensions or a viewBox alone. The Powered by page provides version information and diagnostics.
- Builds generate sitemaps, RSS, `llms.txt`, social metadata and structured data.
- Site delivery settings generate Cloudflare Pages or EdgeOne Makers configuration, CSP and script integrity information. The Skill provides content, output, HTTP and browser checks; EdgeOne output contains delivery rules only. Configure build commands and tool versions on the platform. The Skill provides separate Git-build and output-upload guides for each platform.

## Requirements

- The theme requires Hugo 0.168.0 or later. The Skill CLI supports Windows x64, Linux x64 and macOS x64/ARM64. Linux and macOS use sh without Python. Missing Git is prepared as a portable tool without installing system Git, Homebrew or Xcode. `swban build` reuses compatible tools and downloads missing tools as needed.
- Start a new site from the complete root reference site. Each site owns `hugo.toml`, `content/`, `archetypes/`, `assets/site/` and `assets/i18n/`. The Module does not supply these files.
- Keep `minify.disableJS = true` so HTML minification does not change scripts authorized by CSP.
- When SW is enabled, provide an HTML offline page for each enabled language. The reference configuration disables SW and prefetch by default.
- The separate [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) Skill provides cloud authorization and uploads.

## Known limitations

- Browsers without native render blocking, including Firefox, still display breadcrumb columns asynchronously.
- Accounts, payments and comments are not available. Product lists display product information only.
- SW updates do not automatically reload open pages. Use `disable` to remove an installed SW; `off` does not clean it up.
- Prefetch and prerender depend on browser capabilities and settings. A configured level does not guarantee a download or render.
- Deployment directory names cannot contain ambiguous literal percent encodings such as `a%20b`. Builds reject these names.

See the [User guide (Chinese)](/zh/articles/docs-start/) for configuration and the [Development reference (Chinese)](/zh/articles/docs-dev/) for source maintenance and releases.
