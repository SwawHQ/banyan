---
title: Banyan CLI
date: "2026-10-21T00:00:00+08:00"
url: p/example-tool/
description: 檢查 Banyan 站點和建置後的頁面中繼資料。
offer:
  amount: 0
  currency: "$"
  value: 檢查站點設定和建置後的頁面中繼資料。
---

Banyan CLI 隨 `swaw-banyan` skill 提供。在站點目錄執行以下命令。檢查 `public` 前，先建置站點。

```text
swban doctor .                    #檢查站點和工具
swban check/html/metadata public   #檢查建置後的頁面中繼資料
```

`free` 和 `first-party` 目錄用 `_map.toml` 引用本文。產品列表顯示「免費」和 `offer` 中的價值說明。
