---
title: 02 怎么换成文字首页？
date: 2026-11-17
lastmod: 2026-11-17
url: p/home-minimal/
description: 切换到文字首页，修改标题、说明和正文。
---

## 切换首页

文字首页适合直接介绍站点内容：

1. 打开各语言 `content/home/index*.md`，保留 `layout: page-content-only`。
2. 将正文中的整个风场短代码（含 JSON）替换为 Markdown 标题、介绍和链接。

首页改用图片墙的步骤见[汇总图片墙](/zh/p/home-wall/)。

## 检查结果

运行 `swban server`，在各语言根导航中选择首页，确认标题、说明、正文和链接显示正确。
