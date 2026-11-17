---
title: 08 栏目和文章图标怎么改？
date: 2026-11-17
lastmod: 2026-11-17
url: p/item-icons/
description: 为条目设置图标，并设置栏目的默认图标。
---

编辑目标页面的 `index*.md` 或 `_index*.md`，在已有 `params` 中修改图标字段。

## 设置图标

SVG 名称来自站点根 `assets/site/icons.toml`，例如 `icon: folder`。字符使用 `icon: {text: "©"}`，图片使用 `icon: {image: "0.webp"}`。内容支持三个字段：`icon` 指定自己被列出时的图标，`list_icon_folder`／`list_icon_file` 分别指定本列表中的目录或分类／文章的默认图标。例如产品栏目的 `content/products/_index.zh.md` 可以声明：

```yaml
layout: page-collection-directory
params:
  icon: product
  list_icon_folder: folder
  list_icon_file: product
```

`icon` 指定条目自身图标，优先于列表默认值。条目未设置时，由列出它的列表提供默认图标。`list_icon_folder` 和 `list_icon_file` 沿当前列表的真实祖先继承，最终默认为 `folder` 和 `file`；写入新值可覆盖继承值。

图片先查声明页面的页面包，再查全站 `assets/`。例如 `icon: {image: "badge.webp"}` 使用页面包图片，`icon: {image: "site/favicon.link.svg"}` 使用全站资源；`./badge.webp` 只查页面包。图片默认值从声明目录解析后再继承，不会改为读取子目录的同名图片。

需要单色图标跟随外观时，使用 `icon: {image: "site/favicon.link.svg", monochrome: true}`。浅色显示黑色，深色显示白色；适合透明背景的单色图形，多色细节会合并。省略 `monochrome` 时保留原色。此设置不改变共用该文件的 favicon 或正文图片。

`aggregate` 只选择成员，不继承来源栏目的图标设置。`products-all` 与 `products` 是兄弟入口，需要分别声明列表默认图标；普通文章只设置自身 `icon`。

## 检查结果

运行 `swban dev`，查看目标条目和子条目，再切换浅色、深色外观检查图标。
