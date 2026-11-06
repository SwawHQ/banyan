---
title: Powered by
description: "了解本站使用的技術、建置資訊、PWA 與預取狀態。"
url: powered-by/ #重新命名內容目錄時，保留此網址。
layout: page-article-norss #顯示 Markdown 正文；短代碼啟用互動控制項。
weight: 100

params:
  icon: code
  slots: [breadcrumb] #breadcrumb：路徑導覽欄；meta：文章中繼資料、章節目錄和 BlogPosting；[]：全部關閉。
  site_update: #下方 site-update 短代碼使用的文字。
    labels: #依此語言翻譯文字，保留鍵名。
      checking: "檢查中…"
      installing: "正在安裝新版…"
      check_failed: "檢查失敗"
      unavailable: "目前環境不支援 Service Worker 更新。"
      status_current: "暫無等待啟用的新版"
      status_ready: "新版程式已準備好，瀏覽器將在使用舊程式的頁面關閉後啟用。"
      status_offline: "離線"
      status_click_retry: "請重新檢查"
      content_current: "頁面版本與發佈版本一致"
      content_failed: "版本檢查失敗，請重試"
      mode_off: "本站未啟用 Service Worker 管理。"
      mode_disable: "本站已設定註銷 Service Worker 並清除快取。"
      status_controlled: "此頁面仍由已安裝的 Service Worker 控制。"
      cache_disabled: "快取機制已關閉"
      content_checking: "正在比對版本…"
      content_current_icon: "✅"
      refresh_icon: "↻"
      content_refresh: "重新檢查伺服器版本"
      status_refresh: "檢查 SW 程式更新"
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

**{{< new-tab href="https://github.com/SwawHQ/banyan" >}}Swaw Banyan{{< /new-tab >}}**：{{< new-tab href="/articles/changelog/" >}}{{< theme-version local="本機開發版" >}}{{< /new-tab >}}

### 附：PWA 快取資訊

**本機**：{{< site-update "version" >}}  
**伺服器**：{{< site-update "content" >}}  
**觸發同步**：{{< site-update "interval" "頁面載入時 且 間隔 ≥ %d 分鐘" >}}  
**sw-策略**：{{< site-update "policy" >}}  
**離線頁**：{{< site-update "offline" >}}  
**sw-狀態**：{{< site-update "status" >}}

{{< details-start summary="**更多診斷資訊**" >}}

Hugo：{{< new-tab href="https://gohugo.io/news/" >}}{{< hugo-version >}}{{< /new-tab >}}

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
