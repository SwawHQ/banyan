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
  # 可选 Lastmod 范围：包含起点，不包含终点；子栏目示例见安装说明。
  # time_range: {start: "2000-01-01", end: "2005-02-01"}
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
---
