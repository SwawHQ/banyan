---
title: Web App Manifest 与图标
slug: web-app
description: 了解应用清单，并覆盖站点 favicon 和 PWA 图标。
---

## Manifest

Banyan 生成带指纹的 web app manifest，并在 `<head>` 中输出标准的
`<link rel="manifest">`。清单包含站点名称、启动地址和安装图标地址，
不预取站点内容；浏览器按需读取清单和图标。

Manifest 与 SW 缓存独立。SW 设置见[交付与缓存](/zh/docs/guide/delivery/)。

## 图标

| 源文件 | 用途 |
| --- | --- |
| `static/favicon.ico`、`static/favicon.svg` | 发布为根路径 favicon，供浏览器回退使用 |
| `assets/site/pwa/favicon.svg` | 页面显式链接的指纹 SVG favicon |
| `assets/site/pwa/icon-180.png` | Apple touch 图标 |
| `assets/site/pwa/icon-192.png`、`icon-256.png`、`icon-512.png` | Manifest 图标 |

`assets/site/pwa/` 中的文件由 Hugo 作为指纹资源发布。
在站点根目录提供同路径、同名文件，即可覆盖主题的 favicon 和 PWA 图标。
