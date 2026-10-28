---
title: 風場首頁

params:
  styles: [style.css]
  scripts: [script.js]
  brand_line: 為探索型發布提供清晰結構。
  # home_signal_drift_seconds: 90       #基本週期，單位為秒。
  # home_signal_launch_gap_seconds: 4   #訊號啟動間隔，單位為秒。
  # home_wind_field_start_offset_rem: 6 #訊號區域頂端偏移，單位為 rem。
  # home_signal_guide_chance: 0         #帶尾隨引導線的訊號比例，範圍為 0–100。
  # 訊號按項目順序顯示；省略 url 時只顯示可選取的文字。
  home_signals:
    - name: 文章 - 全部
      url: /zh-tw/articles-all/
      primary: true #將此訊號的週期加倍。
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

{{< home-art/wind/scene >}}
