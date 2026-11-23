# Swaw Banyan

English · [简体中文](README.zh-CN.md)

**A Finder-style Hugo site template for organizing knowledge bases, docs, and catalogs with Miller columns and multi-dimensional categories.**

Like a banyan tree, a single article can branch into multiple categories while keeping one canonical URL — with zero frontend frameworks, pure static output, and a bundled AI Agent toolchain.

[Reference site & docs (banyan.swaw.com)](https://banyan.swaw.com/) ·
[Live showcase (swaw.com)](https://swaw.com/)

## Key Features

### 1. Multi-Dimensional Structure & Views
- **Multi-dimensional categories**: Organize content with nested sections and `_map.toml` references so one canonical article appears across multiple categories while preserving navigation lineage and per-column sorting.
- **Multiple views**: Built-in Finder-style Miller column navigation, article lists, product lists, time-range aggregate lists, and image walls (grid, masonry, and equal-height layouts with horizontal or vertical scrolling).
- **Multilingual & customizable**: Built-in multilingual and RTL support, light/dark modes, swappable color palettes, and pluggable home-art bundles.

### 2. Delivery-Grade Static Engineering
- **Lean & fast**: Hugo-generated static HTML with zero frontend frameworks, zero web fonts, and built-in Pagefind full-text search.
- **Caching, offline & prefetch**: Select platforms, Service Worker mode and prefetch in `assets/deploy/settings.toml`. The Module supplies cache routes and prefetch profiles.
- **Security & dual-platform output**: Build-time SHA-256 CSP hashes for inline scripts, SRI integrity, and generated configs for both Cloudflare Pages (`_headers`, `_redirects`) and Tencent Cloud EdgeOne Makers (`edgeone.json`).
- **Human & AI discovery**: Built-in RSS, JSON-LD structured data, social share images, sitemap, `robots.txt`, and `llms.txt`.

### 3. AI Agent-Ready Operations
- **Self-bootstrapping toolchain**: Root `swban` / `swban.cmd` launchers verify and prepare pinned local tools on demand across Windows x64, Linux x64, and macOS x64/ARM64 without manual Hugo, Go, Node, or Pagefind setup.
- **Bundled Skill**: Includes the `swaw-banyan` Skill for preview, builds, CSP/delivery checks, browser regression tests, and upgrades, with optional [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) integration for cloud deployment.

Banyan focuses on static publishing and edge delivery. Backend features such as accounts, payments, and comments require separate integration.

## Quick Start (AI Agent Friendly)

1. Download **Source code (zip)** from the [latest stable release](https://github.com/SwawHQ/banyan/releases/latest) and extract it as your site directory.

2. Start a local preview from the site root (supports Windows x64, Linux x64, and macOS x64/ARM64):

   Windows (PowerShell):
   ```powershell
   .\swban.cmd server      #Preview drafts and build the search index
   .\swban.cmd server/lan  #Preview on local network devices
   .\swban.cmd build       #Build production site and search index
   ```

   Linux and macOS:
   ```sh
   sh ./swban server      #Preview drafts and build the search index
   sh ./swban server/lan  #Preview on local network devices
   sh ./swban build       #Build production site and search index
   ```

   The root launchers prepare required local tools on demand. Open the URL shown in the terminal, and restart `server` after content edits to refresh the search index. Linux requires `sh`, standard system utilities, `curl`, `tar`, and `sha256sum`; macOS uses built-in utilities. See [Getting started (Chinese)](content/articles/docs-start/getting-started/index.zh.md) for details.

3. Customize for your own site:

   Keep these core files and directories:
   ```text
   hugo.toml                    #Site configuration
   go.mod and go.sum            #Pinned Banyan theme version and checksums
   swban and swban.cmd          #Site command launchers
   .agents/skills/swaw-banyan/  #Bundled Swaw Banyan Skill
   assets/                      #Site config, styles, and brand assets
   i18n/                        #Interface dictionaries
   content/                     #Site pages
   ```

   Remove or replace these example and theme-source paths as needed:
   ```text
   module/                         #Theme source, optional with the published Module
   hugo.work                       #Local theme workspace, optional with the published Module
   content/articles/changelog/     #Banyan release notes
   content/articles/docs-*/        #Banyan documentation
   content/articles/product-info/  #Example product info
   content/products/               #Example product categories and references
   content/products-all/           #Example product list
   ```

   If you remove the documentation or release notes, update the corresponding links on Home and Powered by, then update your site title, domain, icons, and content.

4. Deploy:

   - **Linux / macOS or manual deploy**: Follow [Deploying (Chinese)](content/articles/docs-publish/deploying/index.zh.md) to use Git-connected builds or upload build output.
   - **Windows x64 (AI Agent assisted)**: Install the [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) Skill from the site root:

     ```powershell
     .\swban.cmd base/node/npx --yes skills add SwawHQ/swaw-clouds --skill swaw-clouds -y  #Install deployment Skill
     ```

     Open the site root in your AI Agent and run one of the prompts below:

     Cloudflare Pages:
     ```text
     Use .agents/skills/swaw-banyan to build and check the site locally, then use .agents/skills/swaw-clouds to deploy it to Cloudflare Pages.
     When authorization is needed, run .\.agents\skills\swaw-clouds\swcl.cmd auth/setup and ask me to enter credentials in the authorization interface.
     ```

     Tencent Cloud EdgeOne Makers:
     ```text
     Use .agents/skills/swaw-banyan to build and check the site locally, then use edgeone/cli in .agents/skills/swaw-clouds to deploy it to EdgeOne Makers.
     When authorization is needed, run .\.agents\skills\swaw-clouds\swcl.cmd edgeone/cli login and guide me through the official login process.
     ```

     You can also ask your Agent to purchase domains, configure DNS, or combine Cloudflare and EdgeOne Makers with DNS-ECS routing for mainland China traffic. To open the authorization UI manually:

     ```powershell
     .\.agents\skills\swaw-clouds\swcl.cmd auth/setup  #Open cloud authorization UI
     ```

## Upgrade an Existing Site

1. Check the [Changelog (Chinese)](https://banyan.swaw.com/zh/articles/changelog/) and pick a target version.
2. Open the site root in your AI Agent and prompt:

   ```text
   Use .agents/skills/swaw-banyan. First read help upgrade/git through the root launcher (.\swban.cmd on Windows; sh ./swban on Linux/macOS), then upgrade this site to the latest official Banyan release. Preserve this site's content, URLs, and customizations. Report any unclear changes and wait for confirmation before applying them.
   ```

## Develop the Banyan Theme

Keep `module/` and `hugo.work` in your checkout. Examples below use the `swban` shorthand from the [local development guide (Chinese)](content/articles/docs-dev/local-development/index.zh.md):

```text
swban dev        #Preview local theme source changes
swban dev/build  #Build with local theme source
swban server     #Preview with the version pinned in go.mod
swban build      #Build with the version pinned in go.mod
```

## Documentation

- [Project glossary (Chinese)](content/articles/docs-reference/glossary/index.zh.md)
- [Getting started (Chinese)](content/articles/docs-start/getting-started/index.zh.md)
- [Site configuration (Chinese)](https://banyan.swaw.com/zh/p/site-configuration/)
- [Lists and products (Chinese)](https://banyan.swaw.com/zh/p/collection-lists/)
- [Page regions (Chinese)](https://banyan.swaw.com/zh/p/layout-slots/)
- [Delivery and caching (Chinese)](https://banyan.swaw.com/zh/p/delivery/)
- [Security policies and CSP (Chinese)](https://banyan.swaw.com/zh/p/security-csp/)
- [Site discovery and source links (Chinese)](https://banyan.swaw.com/zh/p/discovery/)
- [Web App Manifest and icons (Chinese)](https://banyan.swaw.com/zh/p/web-app/)
- [Development and release guide (Chinese)](https://banyan.swaw.com/zh/articles/docs-dev/)

## License

[MIT License](LICENSE)  
Copyright (c) 2026 WY Swaw LLC (https://swaw.com)
