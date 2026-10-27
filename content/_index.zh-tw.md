---
# 第一欄導覽包含首頁和已發佈的直屬頁面。
title: Banyan
weight: 110
description: Banyan Hugo 主題的最小參考站點。
layout: page-home

params:
  # 圖示也可使用 assets/site/icons.toml 中的名稱，或 {image: "site/icon-192.png"}。
  icon: { text: "B" }
  # 瀏覽器分頁標題；上方 title 仍作為頁面標題。
  browser_title: Banyan — 極簡 Hugo 發布主題
  # 網站標題旁的簡短說明。
  brand_line: 為探索型發布提供清晰結構。
  # 可選場景設定，以下為預設值。
  # home_signal_drift_seconds: 90       #基本週期，單位為秒。
  # home_signal_launch_gap_seconds: 4   #訊號啟動間隔，單位為秒。
  # home_wind_field_start_offset_rem: 6 #訊號區域頂端偏移，單位為 rem。
  # home_signal_guide_chance: 0         #帶尾隨引導線的訊號比例，範圍為 0–100。
  # 項目依此順序顯示；省略 url 時，文字可選取但沒有連結。
  home_signals:
    - name: 文章 - 全部
      url: /zh-tw/articles-all/
      primary: true #將此訊號的週期加倍，不改變導覽優先順序。
    - name: 文章 - 分類
      url: /zh-tw/articles/
    - name: 產品 - 全部
      url: /zh-tw/products-all/
    - name: 產品 - 分類
      url: /zh-tw/products/
    - name: 使用文件
      url: https://swaw.com/zh/d/banyan/docs/
    - name: GitHub
      url: https://github.com/SwawHQ/banyan
---
