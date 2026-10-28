---
date: "2025-10-11T20:10:44+08:00"
title: "關於"
# linkTitle: "關於" #只替換導覽名稱。
description: "了解 Banyan 如何為 Hugo 站點組織內容目錄和導航。"
url: about/ #重新命名內容目錄時，保留此網址。
weight: 95
layout: page-article-norss #渲染 Markdown 正文，不加入 RSS 項目。

params:
  # browser_title: "關於本站" #替換瀏覽器分頁中、網站名稱前的標題。
  icon: {image: "site/favicon.link.svg"}
  # share_image: false #此頁面不繼承社群預覽圖片。
  slots: [breadcrumb] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
---


Banyan 是一個類似資源管理器的極簡 Hugo 主題。普通目錄組織正文，共享的 `_map.toml` 將文章加入其他欄目。

正如 `theme.toml` 中所定義的：
- **名稱**: banyan
- **標籤**: blog, minimalist
- **描述**: A Explorer-like Hugo theme. (類似資源管理器的極簡主題)

歡迎體驗並使用本主題！
