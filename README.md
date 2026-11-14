# Banyan

English · [简体中文](README.zh-CN.md)

**A website template and Hugo theme built for categorized content, database-free sites, and edge hosting.**


[Demo site 1](https://banyan.swaw.com/) ·
[Demo site 2](https://swaw.com/)

Features:

**1.** Organize resources and articles across multiple categories and levels

**2.** Card walls, Miller column navigation, product lists, and article lists

**3.** Multiple languages, theme switching, and customizable appearance and home page

**4.** Companion Agent Skills for deployment across clouds, maintenance, and operations—managed by your local Agent

**5.** Hugo-generated pages + optimized CDN caching + edge computing + object storage, with no database or self-hosted server

**6.** PWA, Service Worker caching, page prefetch, and automatic CSP/SRI generation

**7.** RSS, social metadata, sitemap, robots.txt, and llms.txt

Backend features such as accounts, payments, and comments are not yet available. They are in development.




## Set up a new site (with help from an AI Agent)


1. Download **Source code (zip)** from the [latest stable release](https://github.com/SwawHQ/banyan/releases/latest). Extract it as your site directory.

2. Start a local preview (Windows x64, run in PowerShell from the site root):
    ```powershell
    .\.agents\skills\swaw-banyan\swban.cmd base/hugo server -D --disableFastRender
    ```

3. Review these four items to understand the site structure:
    ```
    hugo.toml
    archetypes/
    assets/
    content/
    ```

    Delete or replace these resources as needed:
    ```
    content/articles/changelog/  #Banyan release notes
    content/articles/docs/       #Banyan documentation
    content/articles/category1/  #Sample category for your own articles and categories
    content/products/examples/   #Examples of cross-category references through _map.toml
    content/products/            #Root directory for product categories
    content/products-all/        #Product list directory
    ```

    Then set your own site name, domain, logo, and articles.


4. Deploy\
    Install the [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) Skill in PowerShell from the site root:
    ```powershell
    .\.agents\skills\swaw-banyan\swban.cmd base/node/npx --yes skills add SwawHQ/swaw-clouds --skill swaw-clouds -y  #Install the deployment Skill
    ```

    Open the site root in your AI Agent and use this prompt:
    ```
    Use .agents/skills/swaw-banyan to build and check the site locally, then use .agents/skills/swaw-clouds to deploy it to Cloudflare Pages.
    When authorization is needed, run .\.agents\skills\swaw-clouds\swcl.cmd auth/setup and ask me to enter credentials in the authorization interface.
    ```

    For Tencent Cloud EdgeOne Makers:
    ```
    Use .agents/skills/swaw-banyan to build and check the site locally, then use edgeone/cli in .agents/skills/swaw-clouds to deploy it to EdgeOne Makers.
    When authorization is needed, run .\.agents\skills\swaw-clouds\swcl.cmd edgeone/cli login and guide me through the official login process.
    ```

    You can also ask your Agent to purchase domains, configure DNS, or combine Cloudflare with EdgeOne Makers and route mainland China traffic to EdgeOne Makers through DNS-ECS.

    To open the authorization interface manually:
    ```powershell
    .\.agents\skills\swaw-clouds\swcl.cmd auth/setup
    ```


## Upgrade an existing Banyan site
1. Read the [Changelog](https://banyan.swaw.com/zh/articles/changelog/) and choose a version. The example below uses the latest release.

2. Open the site root in your AI Agent and use this prompt:
    ```
    Use .agents/skills/swaw-banyan. First run .\.agents\skills\swaw-banyan\swban.cmd help upgrade/git to read the upgrade steps, then upgrade this site to the latest official Banyan release. Preserve this site's content, URLs, and customizations. If any changes are unclear, report them and wait for confirmation.
    ```



## Documentation


- [Project glossary (Chinese)](content/articles/docs/guide/glossary/index.zh.md)
- [Site configuration](https://banyan.swaw.com/zh/p/site-configuration/)
- [Lists and products](https://banyan.swaw.com/zh/p/collection-lists/)
- [Page regions](https://banyan.swaw.com/zh/p/layout-slots/)
- [Delivery and caching](https://banyan.swaw.com/zh/p/delivery/)
- [Security policies and CSP](https://banyan.swaw.com/zh/p/security-csp/)
- [Site discovery and source links](https://banyan.swaw.com/zh/p/discovery/)
- [Web App Manifest and icons](https://banyan.swaw.com/zh/p/web-app/)
- [Development and release guide](https://banyan.swaw.com/zh/articles/docs/development/)

## License

[MIT License](LICENSE)  
Copyright (c) 2026 WY Swaw LLC (https://swaw.com)
