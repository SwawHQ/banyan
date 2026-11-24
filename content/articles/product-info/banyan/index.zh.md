---
title: Banyan
date: 2026-01-02
lastmod: 2026-11-17
url: p/banyan/
description: 面向文档、文章和产品目录的网站模板兼 Hugo 主题。
params:
  offer:
    amount: 0
    currency: "$"
---

Banyan 是一个网站模板兼 Hugo 主题，适合发布文档、文章、产品和资源目录。它用栏目和文章引用组织内容，以静态页面交付站点，无需数据库。

## 组织内容

- **多层分类**：用栏目建立内容层级，通过面包屑列浏览同级内容。
- **多维分类**：将同一篇文章收录到多个栏目，正文只维护一份。
- **多种展示**：按用途选择文章列表、产品列表、汇总列表或图片墙。

## 定制站点

Banyan 支持多语言、浅色和深色外观。站长可以修改配色、图标、导航和文章辅助内容，也可以在首页或文章中插入风场短代码。

全文搜索使用 Pagefind。RSS、分享图片、sitemap 和 llms.txt 为阅读、订阅和内容发现提供入口。离线访问和页面预取可按需启用。

## 构建和发布

Hugo 预生成页面，配套 swaw-banyan Skill 提供预览、搜索索引构建和检查命令。支持 Windows x64、Linux x64 和 macOS x64/ARM64，也可由本地 AI Agent 协助维护。

站点可发布到 Cloudflare Pages、EdgeOne Makers 或其他静态托管平台。Banyan 为前两者生成交付配置，并提供 CSP 和 SRI 支持。

## 适用范围

Banyan 适合知识库、项目文档、个人文章、产品介绍和资源导航。产品列表用于展示产品信息与价格；账号、支付和评论等后端功能需另行接入。

项目采用 MIT 许可证，可免费使用和修改。目前正在准备首次正式发布。

## 开始使用

1. 按[开始使用](/zh/p/getting-started/)取得站点并在本地预览。
2. 完成[站点设置](/zh/p/site-configuration/)，写下自己的第一篇文章。
3. 按[发布教程](/zh/p/deploying/)构建并上线。

相关入口：[项目源码](https://github.com/SwawHQ/banyan) · [版本说明](/zh/articles/changelog/) · [使用文档](/zh/articles/docs-start/)。
