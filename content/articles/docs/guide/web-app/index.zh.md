---
title: Web App Manifest 与图标
url: p/web-app/
description: 设置站点应用清单、favicon 和 PWA 图标。
---

## Manifest

站点维护完整的 `assets/site/manifest.webmanifest.tmpl`。
Module 读取并执行这份模板，生成 `/site/site.<hash>.webmanifest`，
并在 `<head>` 中输出标准的 `<link rel="manifest">`。
清单包含站点名称、启动地址和安装图标地址，不预取站点内容；浏览器按需读取清单和图标。
清单名称取自 `defaultContentLanguage` 指定语言的首页 `title`。启动地址和颜色直接编辑站点模板。

Manifest 与 SW 缓存独立。SW 设置见[交付与缓存](/zh/p/delivery/)。

## 站点图标

| 源文件 | 用途 |
| --- | --- |
| `assets/site/favicon.ico` | 发布为固定 `/favicon.ico` |
| `assets/site/favicon.link.svg` | 优先使用的指纹图标链接 |
| `assets/site/favicon.link.ico` | 没有链接 SVG 时使用的指纹图标链接 |
| `assets/site/icon-180.png` | Apple touch 图标 |
| `assets/site/icon-192.png`、`icon-256.png`、`icon-512.png` | Manifest 图标 |
| `assets/site/manifest.webmanifest.tmpl` | 完整的站点 manifest 模板 |

表中的文件由站点维护。完整 Banyan 根参考站点已包含这些文件；
新站点从完整参考站点起步，再换成自己的图标并检查 manifest 模板。
已有站点接入 Module 或传统主题目录前，须把参考站点根 `assets/site/`
补到自己的站点根目录。Module 和主题目录不提供图标或 manifest 模板。

`favicon.link.svg` 与 `favicon.link.ico` 同时存在时，只输出 SVG 的图标链接；
选中的文件带指纹发布到 `/site/*`。`favicon.ico` 独立发布，不自动生成图标链接。
至少需要一种 favicon 源；三种文件全部缺失时构建失败。
四个 PWA PNG 图标也带指纹发布，缺失时构建失败；SW 关闭时仍需要它们和 manifest 模板。
本地授权页从同一目录读取图标，依次选择链接 SVG、链接 ICO、固定 ICO。
同目录中的其它品牌素材为可选文件，不会自动成为分享图。

配色文件由站点维护，参考配色位于根 `assets/site/`。
风场艺术包的 `home-art/wind/scene` 短代码内联风向袋 SVG，不发起独立图片请求。修改形状时覆写站点的 `layouts/_shortcodes/home-art/wind/scene.html`；样式与脚本放在 `content/_res/home-art/wind/`，颜色继续由所选 CSS 调色板控制。
