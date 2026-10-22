---
root_nav: true
title: Powered by
icon: code
description: "了解本站使用的技術、建置資訊與 PWA 狀態。"
url: powered-by/
layout: page-powered-by
weight: 96
outputs: [HTML]
build:
  list: local
slots:
  breadcrumb: true
powered_by:
  banyan: "本站使用的 Hugo 主題，提供多欄瀏覽、多語言頁面與離線存取等能力。"
  hugo: "用於產生本站的靜態網站產生器。"
  source: "原始碼"
  changes: "變更記錄"
  website: "官網"
  releases: "發佈記錄"
  theme_version: "主題版本"
  local_version: "本機開發版"
  version: "版本"
  build: "本站建置"
  pwa: "支援離線存取；Service Worker 程式更新由瀏覽器管理。"
site_update:
  labels:
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
    controlled: "目前頁面受 Service Worker 控制"
    yes: "是"
    no: "否"
---

{{< powered-by >}}
