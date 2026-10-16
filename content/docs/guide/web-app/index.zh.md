---
title: Web App Manifest 与图标
slug: web-app
description: 选择 manifest 发现时机，并覆盖站点 favicon 和 PWA 图标。
---

## Manifest

Banyan 默认生成带指纹的 web app manifest，并在渲染关键资源之后输出链接。
在站点根 `hugo.toml` 中选择模式：

```toml
[params.web_app_manifest]
mode = "defer"
```

| 模式 | 行为 |
| --- | --- |
| `link` | 在 head 中较早输出链接，尽早发现 manifest |
| `defer` | 在 head 末尾输出链接，优先发现渲染关键资源 |
| `off` | 不生成或链接 manifest |

Manifest 与 SW 缓存独立配置。SW 设置见[交付与缓存](/zh/docs/guide/delivery/)。

## 图标

| 源文件 | 用途 |
| --- | --- |
| `static/favicon.ico`、`static/favicon.svg` | 发布为根路径 favicon，供浏览器回退使用 |
| `assets/site/pwa/favicon.svg` | 页面显式链接的指纹 SVG favicon |
| `assets/site/pwa/icon-180.png` | Apple touch 图标 |
| `assets/site/pwa/icon-192.png`、`icon-256.png`、`icon-512.png` | Manifest 图标 |

`assets/site/pwa/` 中的文件由 Hugo 作为指纹资源发布。
在站点根目录提供同路径、同名文件，即可覆盖主题的 favicon 和 PWA 图标。
