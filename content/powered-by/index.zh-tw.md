---
title: Powered by
description: "了解本站使用的技術、建置資訊、PWA 與預取狀態。"
url: powered-by/ #重新命名內容目錄時，保留此網址。
layout: page-article-norss #顯示 Markdown 正文；短代碼啟用互動控制項。
weight: 96

params:
  icon: code
  slots: [breadcrumb] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
  site_update: #下方 site-update 短代碼使用的文字。
    labels: #依此語言翻譯文字，保留鍵名。
      check: "檢查更新"
      checking: "檢查中…"
      installing: "正在安裝新版…"
      check_failed: "檢查失敗"
      unavailable: "目前環境未啟用或不支援 Service Worker 更新。"
      status: "更新狀態"
      status_current: "暫無等待啟用的新版"
      status_ready: "新版程式已準備好，瀏覽器將在使用舊程式的頁面關閉後啟用。"
      status_offline: "離線"
      status_click_retry: "請重新檢查"
  prefetch_debug:
    labels:
      backend: "預取方式"
      auto: "自動"
      native: "瀏覽器原生"
      sw: "Service Worker"
      link: "連結預取"
      off: "關閉"
      apply: "套用並重新載入"
      loading: "載入中…"
      unavailable: "無法使用"
      collection: "欄目"
      article: "文章"
---

## Banyan {#banyan}

本站使用的 Hugo 主題，提供多欄瀏覽、多語言頁面與離線存取等能力。

{{< theme-version label="主題版本" local="本機開發版" >}}

{{< new-tab href="https://github.com/SwawHQ/banyan" >}}原始碼{{< /new-tab >}} · {{< new-tab href="https://swaw.com/d/banyan/changelog/" >}}變更記錄{{< /new-tab >}}

## Hugo {#hugo}

用於產生本站的靜態網站產生器。

版本：{{< hugo-version >}}

{{< new-tab href="https://gohugo.io/" >}}官網{{< /new-tab >}} · {{< new-tab href="https://gohugo.io/news/" >}}發佈記錄{{< /new-tab >}}

## 本站建置 {#build}

{{< site-build >}}

## PWA {#pwa}

支援離線存取；Service Worker 程式更新由瀏覽器管理。

{{< site-update >}}

## 預取診斷 {#diagnostics}

{{< details-start summary="檢視診斷資訊" >}}

此處的選擇只影響本頁。選擇預取方式後，套用並重新載入。

{{< prefetch-debug-controls >}}

此選擇不會略過 Service Worker 的請求攔截，也不會取消註冊 Service Worker。

要略過請求攔截，請在開發人員工具中開啟 Application → Service Workers，勾選 Bypass for network。瀏覽器原生預取記錄位於 Application → Speculative loads。

### 測試連結

將指標移到連結上，或用鍵盤聚焦連結。在觸控螢幕上，輕觸連結。瀏覽器依目前策略排程預取。

{{< prefetch-debug-links >}}

### 瀏覽器支援

{{< prefetch-debug-state "support" >}}

### 目前後端

{{< prefetch-debug-state "env" >}}

### 候選連結

{{< prefetch-debug-state "actions" >}}

### 自訂排程

{{< prefetch-debug-state "runtime" >}}

### 發佈設定與規則

{{< prefetch-debug-state "payload" >}}

{{< details-end >}}
