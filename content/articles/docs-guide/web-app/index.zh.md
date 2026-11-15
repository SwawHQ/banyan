---
title: 外观 · 应用名称与图标
date: 2026-11-06
lastmod: 2026-11-15
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

参考站使用 SVG 页面图标，并提供表中的浏览器图标和安装图标。替换其中实际使用的文件，再检查浅色、深色和浏览器标签上的显示。SVG 可使用原有尺寸或只声明 `viewBox`。

`favicon.link.svg` 与 `favicon.link.ico` 同时存在时使用 SVG；如果想改用 ICO，需要移除对应 SVG。`favicon.ico` 单独发布，不能只替换它就认为页面标签图标也已改变。

安装图标与文章分享图分别设置，分享图见[站点发现](/zh/p/discovery/#分享图片)。

## Manifest

打开 `assets/site/manifest.webmanifest.tmpl`，修改已有值：

| 内容 | 修改位置 |
| --- | --- |
| 应用名称 | 默认语言首页的 `title` |
| 启动网址 | 模板中的 `start_url` |
| 应用范围 | 模板中的 `scope` |
| 应用标识 | 模板中的 `id` |
| 启动背景和主题颜色 | 模板中的 `background_color`、`theme_color` |

参考模板自动根据 `baseURL` 设置应用标识、启动网址和范围，部署在子目录时无需另改这三项。需要自定义启动页或范围时，再修改对应模板值。

保存后重新构建。在浏览器开发者工具的 Application → Manifest 中检查应用名称、图标和启动地址；不支持该面板的浏览器可查看页面的 manifest 链接。完成正式部署后，再检查安装入口和已安装应用的显示。
