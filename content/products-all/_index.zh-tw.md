---
# 在第一欄導覽顯示此首頁直屬頁面；weight 控制順序。
title: 產品 - 全部
description: 在一個清單中瀏覽全部產品引用。
weight: 30
layout: page-collection-products-all

params:
  # icon: {text: "P"} #覆寫此項目的預設資料夾圖示。
  # 清單項目繼承這些預設圖示；各項目自己的 icon 優先。
  # list_icon_folder: folder
  list_icon_file: product
  # aggregate 讀取此欄目下的全部文章及 _map.toml 引用，並去除重複項目。
  aggregate: /products
  slots: [breadcrumb] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
---
