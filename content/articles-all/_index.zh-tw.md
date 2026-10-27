---
# 在第一欄導覽顯示此首頁直屬頁面；weight 控制順序。
title: 文章 - 全部
description: 在一個清單中瀏覽全部文章。
weight: 10
layout: page-collection-directory-all

params:
  # icon: {text: "A"} #覆寫此項目的預設資料夾圖示。
  # aggregate 讀取此欄目下的全部文章及 _map.toml 引用，並去除重複項目。
  aggregate: /articles
  slots: [breadcrumb] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
---
