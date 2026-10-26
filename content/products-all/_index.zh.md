---
# 在第一列导航中显示此首页直属子栏目；weight 决定顺序。
title: 产品 - 全部
description: 在一个列表中浏览全部产品引用。
weight: 30
layout: page-collection-products-all

params:
  # icon: {text: "P"} #替换此栏目的默认文件夹图标。
  # 列表行图标继承这些默认值；各行自身的 icon 优先。
  # list_icon_folder: folder
  list_icon_file: product
  # aggregate 汇总此栏目下的文章和 _map.toml 引用，并去除重复项。
  aggregate: /products
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
---
