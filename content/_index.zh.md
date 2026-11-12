---
# 第一列导航包含首页和已发布的直属子页面。
title: Banyan
weight: 10
description: Banyan Hugo 主题的最小参考站点。
layout: page-home

params:
  # 切换图片墙时：修改 layout，启用 aggregate 与 wall，并移除正文 home-art 短代码。
  # aggregate: /articles #来源栏目：包含下级文章及引用，同一篇只显示一次。
  # 配套 layout: page-collection-wall-all 使用；启用图片墙时取消下方 params.wall 的注释。
  # wall:
  #   size:                #图片区域的目标 CSS px；实际尺寸随可用空间调整，不含标题与间距。
  #     width: 300        #数值：目标宽度；auto：按原图比例计算宽度。宽高均为数值时，按指定比例居中裁剪。
  #     height: 125        #数值：目标高度；auto：按原图比例计算高度。宽高不能同时为 auto。
  #   details: title       #title：一行标题展开详情；overlay：图内细点常显；overlay-hover：悬停显示，触屏常显。
  #   scroll: horizontal   #horizontal：横向滚动；vertical：竖向滚动。
  show_navigation: true
  # 图标也可使用 assets/site/icons.toml 中的名称，或 {image: "site/icon-192.png"}。
  icon: {image: "site/favicon.link.svg"}
  # 浏览器标签页标题；上方 title 仍用于页面可见标题。
  browser_title: Banyan — 极简 Hugo 发布主题
---

{{< home-art "/_res/home-art/wind" >}}
