---
title: Web App Manifest 与图标
date: 2026-11-06
lastmod: 2026-11-14
url: p/web-app/
description: 替换浏览器和安装图标，设置应用名称、启动地址与颜色。
---

Manifest 是浏览器读取的应用清单，用于安装后的应用名称、启动地址和图标。它与 SW 缓存分别配置；关闭 SW 时仍需保留应用清单和图标文件。

## 站点图标

在 `assets/site/` 中替换下列文件，保留原文件名：

| 源文件 | 用途 |
| --- | --- |
| `favicon.ico` | 固定地址的浏览器图标 |
| `favicon.link.svg` | 页面优先使用的 SVG 图标 |
| `favicon.link.ico` | 没有上述 SVG 时使用的 ICO 图标 |
| `icon-180.png` | 180 × 180 的 Apple touch 图标 |
| `icon-192.png`、`icon-256.png`、`icon-512.png` | 对应尺寸的安装图标 |

参考站已包含这些文件。先替换其中实际使用的图标，再检查浅色、深色和浏览器标签上的显示。SVG 保留与图形匹配的 `viewBox`，并声明 `width="32" height="32"`。

`favicon.link.svg` 与 `favicon.link.ico` 同时存在时使用 SVG；如果想改用 ICO，需要移除对应 SVG。`favicon.ico` 单独发布，不能只替换它就认为页面标签图标也已改变。

四个 PNG 图标都要保留。图标缺失或格式不正确时，先按构建提示修复。它们不会自动成为文章分享图，分享图另见[站点发现](/zh/p/discovery/#分享图片)。

## Manifest

打开 `assets/site/manifest.webmanifest.tmpl`，修改已有值：

| 内容 | 修改位置 |
| --- | --- |
| 应用名称 | 默认语言首页的 `title` |
| 启动网址 | 模板中的 `start_url` |
| 应用范围 | 模板中的 `scope` |
| 应用标识 | 模板中的 `id` |
| 启动背景和主题颜色 | 模板中的 `background_color`、`theme_color` |

这是模板文件，不是普通 JSON。保留图标读取及名称生成部分，只修改需要的值。部署在子目录中时，要同时检查 `id`、`start_url` 和 `scope`，不要沿用指向域名根目录的 `"/"`。

保存后重新构建。在浏览器开发者工具的 Application → Manifest 中检查应用名称、图标和启动地址；不支持该面板的浏览器可查看页面的 manifest 链接。完成正式部署后，再检查安装入口和已安装应用的显示。
