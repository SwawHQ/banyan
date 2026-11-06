---
title: Powered by
description: "了解本站使用的技术、构建信息、PWA 与预取状态。"
url: powered-by/ #重命名内容目录时保留此网址。
layout: page-article-norss #显示 Markdown 正文；短代码启用交互控件。
weight: 100

params:
  icon: code
  slots: [breadcrumb] #breadcrumb：路径导航列；meta：文章元信息、章节目录和 BlogPosting；[]：全部关闭。
  site_update: #下方 site-update 短代码使用的文字。
    labels: #按当前语言翻译值；保留键名。
      checking: "检查中…"
      installing: "正在安装新版…"
      check_failed: "检查失败"
      unavailable: "当前环境不支持 Service Worker 更新。"
      status_current: "暂无等待启用的新版"
      status_ready: "新版程序已准备好，浏览器将在使用旧程序的页面关闭后启用。"
      status_offline: "离线"
      status_click_retry: "请重新检查"
      content_current: "页面版本与发布版本一致"
      content_failed: "版本检查失败，请重试"
      mode_off: "本站未启用 Service Worker 管理。"
      mode_disable: "本站已配置注销 Service Worker 并清理缓存。"
      status_controlled: "此页面仍由已安装的 Service Worker 控制。"
      cache_disabled: "缓存机制已关闭"
      content_checking: "正在比对版本…"
      content_current_icon: "✅"
      refresh_icon: "↻"
      content_refresh: "刷新服务器版本"
      status_refresh: "检查 SW 程序更新"
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

**{{< new-tab href="https://github.com/SwawHQ/banyan" >}}Swaw Banyan{{< /new-tab >}}**：{{< new-tab href="/zh/articles/changelog/" >}}{{< theme-version local="本地开发版" >}}{{< /new-tab >}}

### PWA 缓存信息：

**本地**：{{< site-update "version" >}}  
**服务器**：{{< site-update "content" >}}  
**触发同步**：{{< site-update "interval" "页面加载时 且 间隔 ≥ %d 分钟" >}}  
**sw-策略**：{{< site-update "policy" >}}  
**离线页**：{{< site-update "offline" >}}  
**sw-状态**：{{< site-update "status" >}}

{{< details-start summary="**更多诊断信息**" >}}

Hugo：{{< new-tab href="https://gohugo.io/news/" >}}{{< hugo-version >}}{{< /new-tab >}}

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
