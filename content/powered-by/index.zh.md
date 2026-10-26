---
title: Powered by
description: "了解本站使用的技术、构建信息、PWA 与预取状态。"
url: powered-by/ #重命名内容目录时保留此网址。
layout: page-article-norss #显示 Markdown 正文；短代码启用交互控件。
weight: 96

params:
  icon: code
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
  site_update: #下方 site-update 短代码使用的文字。
    labels: #按当前语言翻译值；保留键名。
      check: "检查更新"
      checking: "检查中…"
      installing: "正在安装新版…"
      check_failed: "检查失败"
      unavailable: "当前环境未启用或不支持 Service Worker 更新。"
      status: "更新状态"
      status_current: "暂无等待启用的新版"
      status_ready: "新版程序已准备好，浏览器将在使用旧程序的页面关闭后启用。"
      status_offline: "离线"
      status_click_retry: "请重新检查"
  prefetch_debug:
    labels:
      backend: "预取方式"
      auto: "自动"
      native: "浏览器原生"
      sw: "Service Worker"
      link: "链接预取"
      off: "关闭"
      apply: "应用并重新加载"
      loading: "加载中…"
      unavailable: "不可用"
      collection: "栏目"
      article: "文章"
---

## Banyan {#banyan}

本站使用的 Hugo 主题，提供多列浏览、多语言页面与离线访问等能力。

{{< theme-version label="主题版本" local="本地开发版" >}}

{{< new-tab href="https://github.com/SwawHQ/banyan" >}}源码{{< /new-tab >}} · {{< new-tab href="https://swaw.com/zh/d/banyan/changelog/" >}}变更记录{{< /new-tab >}}

## Hugo {#hugo}

用于生成本站的静态站点生成器。

版本：{{< hugo-version >}}

{{< new-tab href="https://gohugo.io/" >}}官网{{< /new-tab >}} · {{< new-tab href="https://gohugo.io/news/" >}}发布记录{{< /new-tab >}}

## 本站构建 {#build}

{{< site-build >}}

## PWA {#pwa}

支持离线访问；Service Worker 程序更新由浏览器管理。

{{< site-update >}}

## 预取诊断 {#diagnostics}

{{< details-start summary="查看诊断信息" >}}

此处的选择只影响本页。选择预取方式后，应用并重新加载。

{{< prefetch-debug-controls >}}

此选择不会绕过 Service Worker 的请求拦截，也不会注销 Service Worker。

要绕过请求拦截，请在开发者工具中打开 Application → Service Workers，选中 Bypass for network。浏览器原生预取记录位于 Application → Speculative loads。

### 测试链接

将指针移到链接上，或用键盘聚焦链接。在触摸屏上，轻触链接。浏览器按当前策略调度预取。

{{< prefetch-debug-links >}}

### 浏览器支持

{{< prefetch-debug-state "support" >}}

### 当前后端

{{< prefetch-debug-state "env" >}}

### 候选链接

{{< prefetch-debug-state "actions" >}}

### 自定义调度

{{< prefetch-debug-state "runtime" >}}

### 发布配置与规则

{{< prefetch-debug-state "payload" >}}

{{< details-end >}}
