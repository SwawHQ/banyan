---
title: 04 怎么设置图片墙和封面？
date: 2026-11-17
lastmod: 2026-11-17
url: p/image-wall/
description: 把栏目改成图片墙，为文章和子栏目设置封面。
---

图片墙用封面卡片显示直属子栏目、文章和引用。子栏目在前，文章在后；文章按发布日期倒序排列。

## 启用栏目图片墙

1. 打开目标栏目的 `_index.zh.md`，例如 `content/articles/notes/_index.zh.md`。
2. 将 `layout` 改为 `page-collection-wall`，在已有 `params` 中设置 `wall`。
3. 为文章和子栏目放入封面，按下面的方法预览。

```yaml
layout: page-collection-wall
params:
  slots: [breadcrumb]
  wall:
    size: {width: auto, height: 200}
    details: title
    scroll: horizontal
```

点击封面进入目录或文章；点击标题或细点打开同一种详情浮窗。目录用小图标区分，说明和文章数放在浮窗内。目录封面取包内 `cover.*`；无封面时显示该目录的 `description`，说明为空或与标题相同时，居中显示站点图标。

只有当前列显示图片墙。进入子目录后，父列使用原有紧凑导航；子目录按自己的 layout 显示。要让下级栏目也使用图片墙，在 `cascade` 中为 `target: {kind: section}` 设置该 layout、`params.wall` 和 `params.slots: [breadcrumb]`。这些排列配置只给栏目，文章的 `params.wall` 仍用于封面。

## 设置封面

在文章页面包中放置 `cover.jpg`、`cover.png` 等封面图片。使用其他文件名时，在文章的页面元数据中指定包内文件：

```yaml
params:
  wall:
    cover: photo.jpg
    alt: 山间的雾
    kind: image
```

未指定文件时读取包内 `cover.*`；没有封面时居中显示 `assets/site/favicon.link.svg`，缺少时使用 `assets/site/favicon.ico`。目录独立说明使用正文字号。`kind: video` 只显示三角标记，点击仍进入文章，视频由文章正文提供。封面由构建处理为带指纹的 WebP，不读取继承的分享图片。

## 检查结果

运行 `swban server`，打开目标栏目。确认封面显示正确，点击图片可进入文章，点击标题可打开详情。其他语言分别修改对应栏目文件。

首页展示全部文章见[首页图片墙](/zh/p/home-wall/)，卡片大小和滚动方向见[图片墙排列](/zh/p/wall-layout/)。
