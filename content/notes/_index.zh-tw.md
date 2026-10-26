---
# 在第一欄導覽顯示此首頁直屬頁面；weight 控制順序。
title: 筆記 - 分類
description: 按分類瀏覽筆記。
weight: 20
layout: page-collection-directory

params:
  # 此項目使用預設資料夾圖示；設定以下其中一種值可替換。
  # icon: folder
  # icon: {text: "N"}
  # icon: {image: "site/icon-192.png", monochrome: true}
  # 清單項目繼承這些預設圖示；各項目自己的 icon 優先。
  # list_icon_folder: folder
  # list_icon_file: file
  slots: [breadcrumb] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。

# 下層頁面使用這些預設值，可在各自的 front matter 中覆寫。
cascade:
  - target: {kind: page}
    layout: page-article-rss
    params:
      slots: [breadcrumb, meta] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
  - target: {kind: section}
    layout: page-collection-directory
    params:
      slots: [breadcrumb] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
---
