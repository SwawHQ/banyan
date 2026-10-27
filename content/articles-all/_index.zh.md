---
# 在第一列导航中显示此首页直属子栏目；weight 决定顺序。
title: 文章 - 全部
description: 在一个列表中浏览全部文章。
weight: 10
layout: page-collection-directory-all

params:
  # icon: {text: "A"} #替换此栏目的默认文件夹图标。
  # aggregate 汇总此栏目下的文章和 _map.toml 引用，并去除重复项。
  aggregate: /articles
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
---
