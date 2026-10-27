---
# 在第一列导航中显示此首页直属子栏目；weight 决定顺序。
title: 文章 - 分类
description: 按分类浏览文章。
weight: 20
layout: page-collection-directory

params:
  # 此栏目使用默认文件夹图标；设置以下任意一种值可替换它。
  # icon: folder
  # icon: {text: "A"}
  # icon: {image: "site/icon-192.png", monochrome: true}
  # 列表行图标继承这些默认值；各行自身的 icon 优先。
  # list_icon_folder: folder
  # list_icon_file: file
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。

# 后代页面使用这些默认值；各页面可在自己的 front matter 中覆盖。
cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
  - target: {kind: section}
    layout: page-collection-directory
    params:
      slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
---
