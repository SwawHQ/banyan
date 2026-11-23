---
title: 离线：怎么设置离线访问？
date: 2026-11-17
lastmod: 2026-11-17
url: p/offline-access/
description: 启用本站 Service Worker，验证断网浏览并检查停用结果。
---

离线访问使用本站 Service Worker（SW）缓存已访问的受管资源。首次启用后先联网访问页面，使缓存就绪。

## 启用离线访问

1. 打开 `assets/deploy/settings.toml`。
2. 在已有 `[sw]` 中将 `mode` 改为 `"enable"`，保留原有路由配置。
3. 按[发布教程](/zh/p/deploying/)构建、检查并部署到 HTTPS 站点。

配置示例：

```toml
[sw]
mode = "enable"
```

检查间隔由交付策略文件中的 `sw.content_check_interval` 设置。断网打开未缓存的受管页面时，SW 直接返回英文提示。

缓存范围由各路由的 `sw.bucket` 控制，字段含义见[交付配置](/zh/p/delivery/#service-worker)。

## 检查结果

1. 联网打开已部署站点，在 Powered by 页面确认 SW 已启用；必要时刷新，让页面受 SW 控制。
2. 打开几篇文章，等待资源加载完成。
3. 断网后重新打开这些文章，检查正文和图片。
4. 打开一个尚未缓存的页面，检查离线提示，再恢复网络。

离线可用范围取决于缓存路由和已保存的资源。自动化检查见[浏览器检查](/zh/p/browser-regression/)。

## 更新内容

使用 `swban build` 重新构建发布。站点构建版本默认随构建生成；自行设置 `params.build.version` 时，每次内容发布都更新该值。新版本用于后续请求，已打开页面可手动刷新查看新内容。

## 停用并清理缓存

将已有配置改为：

```toml
[sw]
mode = "disable"
```

重新部署后，访客再次访问时会注销本站 SW，并清理受管缓存。在浏览器开发工具中检查 Service Workers 和 Cache Storage，确认清理完成。

`off` 适用于无需加载 SW 管理逻辑的站点；它会保留访客已经安装的 SW。停用已上线的 SW 时使用 `disable`。
