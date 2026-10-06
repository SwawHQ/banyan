---
root_nav: true
title: Powered by
icon: code
description: "了解本站使用的技术、构建信息与 PWA 状态。"
slug: powered-by
layout: page-powered-by
weight: 96
outputs: [HTML]
build:
  list: local
slots:
  breadcrumb: true
powered_by:
  banyan: "本站使用的 Hugo 主题，提供多列浏览、多语言页面与离线访问等能力。"
  hugo: "用于生成本站的静态站点生成器。"
  source: "源码"
  changes: "变更记录"
  website: "官网"
  releases: "发布记录"
  revision: "主题提交"
  dirty: "有未提交修改"
  version: "构建版本"
  build: "本站构建"
  time: "构建时间"
  commit: "站点提交"
  pwa: "支持离线访问；新版准备好后，会在下一次站内同标签页跳转时启用。"
site_update:
  labels:
    check: "检查更新"
    checking: "检查中…"
    installing: "正在安装新版…"
    check_failed: "检查失败"
    unavailable: "当前环境未启用或不支持 Service Worker 更新。"
    status: "更新状态"
    status_current: "暂无等待启用的新版"
    status_ready: "新版已准备好，将在下一次站内同标签页跳转时启用。"
    status_offline: "离线"
    status_click_retry: "请重新检查"
    controlled: "当前页面受 Service Worker 控制"
    yes: "是"
    no: "否"
---

{{< powered-by >}}
