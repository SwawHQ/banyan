---
title: 05 怎么调整图片墙排列？
date: 2026-11-17
lastmod: 2026-11-17
url: p/wall-layout/
description: 设置卡片比例、标题显示和横向或纵向滚动。
---

先[启用图片墙](/zh/p/image-wall/)，再编辑该页面 `_index*.md` 中已有的 `params.wall`。

## 修改排列

例如，使用等高卡片和横向滚动：

```yaml
params:
  wall:
    size: {width: auto, height: 200}
    details: title
    scroll: horizontal
```

| 配置 | 可选值 | 默认值 |
| --- | --- | --- |
| `size.width` | 目标宽度，CSS px；`auto` 按原图比例计算 | `200` |
| `size.height` | 目标高度，CSS px；`auto` 按原图比例计算 | `auto` |
| `details` | `title` 一行标题、`overlay` 图内细点常显、`overlay-hover` 悬停显示（触屏常显） | `title` |
| `scroll` | `horizontal` 横向、`vertical` 竖向 | `vertical` |

宽高均为数值时使用固定比例网格，例如 `300 × 200` 为 3:2，封面居中裁剪。`200 × auto` 使用等宽瀑布流，`auto × 200` 使用等高排列，两者保留原图比例。

尺寸不含标题与间距，是卡片的最大尺寸；空间不足时缩小，不放大补满空白。点击图片进入文章，点击标题或细点查看完整标题、所属栏目和发布日期。图片墙不显示排序栏、栏目介绍或页面页脚。

## 检查结果

运行 `swban server`，检查宽屏和手机宽度下的封面裁剪、标题与滚动方向。
