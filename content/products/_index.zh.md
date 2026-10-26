---
# 在第一列导航中显示此首页直属子栏目；weight 决定顺序。
title: 产品 - 分类
description: 按分类浏览产品。
weight: 40
layout: page-collection-directory

params:
  # icon: {text: "P"} #替换此栏目的默认文件夹图标。
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
  # 列表行图标继承这些默认值；各行自身的 icon 优先。
  # list_icon_folder: folder
  list_icon_file: product

# 后代页面使用这些默认值；各页面可在自己的 front matter 中覆盖。
cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
  - target: {kind: section}
    layout: page-collection-products
    params:
      slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
---
