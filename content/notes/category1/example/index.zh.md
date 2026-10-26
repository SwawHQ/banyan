---
title: 示例文章
# 简短的列表名称；省略时使用 title。
# linkTitle: 简短标题
# 修改文章内容时更新 lastmod；移动文件时保留它。
date: "2026-01-02T00:00:00+08:00"
lastmod: "2026-01-02T00:00:00+08:00"
# 移动或重命名本文目录时保留此网址。
url: p/example-product/
description: 在笔记和产品列表中显示同一篇文章。
# 栏目 cascade 提供 layout 和 slots；需要覆盖时才取消注释。
# layout: page-article-rss

params:
  # 替换浏览器标签页标题；不改变页面可见标题。
  # browser_title: 浏览器标题
  # slots: [breadcrumb, meta] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
  # 列表图标；省略时使用列表默认值。选择一种写法。
  # icon: file
  # icon: {text: "N"}
  # icon: {image: "site/favicon.link.svg", monochrome: true}
  # 省略时继承分享预览图；false 停止继承。本地文件放在本文目录。
  # share_image: cover.jpg
  # share_image: false
  # 其他发布版本的链接。GitHub 源码链接由 hugo.toml 配置。
  # published_links:
  #   - label: 其他发布版本
  #     url: https://example.com/article

  # 产品列表显示的信息；不决定文章所属目录。
  offer:
    amount: 0
    currency: "$"
    value: 用不同列表展示同一篇文章。
---

本文实际归属笔记目录。产品目录通过 `_map.toml` 引用本文。

笔记列表显示文章元信息。产品列表使用 `offer` 显示价格和价值说明。两种列表都链接到本页。
