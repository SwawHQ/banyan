---
title: 範例文章
# 清單中的簡短名稱；省略時使用 title。
# linkTitle: 簡短標題
# 文章內容變更時更新 lastmod；移動檔案時不變更。
date: "2026-01-02T00:00:00+08:00"
lastmod: "2026-01-02T00:00:00+08:00"
# 移動或重新命名本文目錄時，保留此網址。
url: p/example-product/
description: 在筆記和產品清單中顯示同一篇文章。
# 欄目的 cascade 提供 layout 和 slots；需要覆寫時才取消註解。
# layout: page-article-rss

params:
  # 覆寫瀏覽器分頁標題，不改變頁面標題。
  # browser_title: 瀏覽器標題
  # slots: [breadcrumb, meta] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
  # 清單項目的圖示；省略時使用清單預設值。選擇以下其中一種格式。
  # icon: file
  # icon: {text: "N"}
  # icon: {image: "site/favicon.link.svg", monochrome: true}
  # 省略時繼承分享圖片；false 停止繼承。本機圖片放在本文目錄中。
  # share_image: cover.jpg
  # share_image: false
  # 其他發布版本的連結；GitHub 原始檔連結使用 hugo.toml 設定。
  # published_links:
  #   - label: 其他發布版本
  #     url: https://example.com/article

  # 產品清單的顯示值，不控制文章所屬目錄。
  offer:
    amount: 0
    currency: "$"
    value: 用不同清單展示同一篇文章。
---

本文實際歸屬筆記目錄。產品目錄透過 `_map.toml` 引用本文。

筆記清單顯示文章中繼資料。產品清單使用 `offer` 顯示價格和價值說明。兩種清單都連結到本頁。
