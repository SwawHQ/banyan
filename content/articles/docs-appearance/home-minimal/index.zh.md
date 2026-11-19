---
title: 02 怎么换成文字首页？
date: 2026-11-17
lastmod: 2026-11-17
url: p/home-minimal/
description: 切换到文字首页，修改标题、说明和正文。
---

## 切换首页

文字首页适合直接介绍站点内容：

1. 打开各语言 `content/_index*.md`，保留 `layout: page-home`。
2. 将正文中的 `home-art` 路径从 `/_res/home-art/wind` 改为 `/_res/home-art/minimal`。
3. 编辑 `content/_res/home-art/minimal/index*.md` 中的 `params.heading`、`params.description` 和 Markdown 正文。

需要独立定制时，先复制整个 `minimal/` 目录，再将首页引用改为新目录名。颜色与排版在包内 `style.css` 中修改；只改文字时不需要编辑模板。首页改用图片墙的步骤见[汇总图片墙](/zh/p/home-wall/)。

## 检查结果

运行 `swban server`，打开各语言首页，确认标题、说明、正文和链接显示正确。
