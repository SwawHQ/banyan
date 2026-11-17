---
title: 分享：怎么设置分享图片？
date: 2026-11-17
lastmod: 2026-11-17
url: p/share-images/
description: 为文章设置分享卡片图片，或配置全站默认图片。
---

## 添加图片

1. 将 `cover.jpg` 放入文章页面包，与 `index*.md` 放在同一目录。
2. 在文章已有的 `params` 中设置 `share_image`。
3. 重新构建并发布。

## 图片来源

例如：

```yaml
params:
  share_image: cover.jpg
```

相对路径读取声明页面包中的文件。可处理的位图会缩放到
`1200 × 630` 范围内，转为 JPEG，并以带哈希的地址发布；其他文件直接发布为带哈希的资源。
也可使用站点根路径（如 `/images/share.jpg`）或绝对 `https://` URL，直接用于分享卡片。

未声明时，按当前页、最近祖先到最远祖先、当前语言首页的顺序查找。
首页的声明可提供全站默认图片；继承图片时仍从声明页面包读取。
`share_image: false` 关闭该页的分享图片，并停止继续查找祖先默认值。
此字段同时用于 Open Graph 和 Twitter 卡片。

## 检查结果

```text
swban check/content/share-image  #检查分享图声明
```

发布后查看页面源码中的 `og:image` 和 `twitter:image`，打开对应图片地址确认可访问。分享平台可能保留旧卡片，需要等待或使用该平台的刷新工具。图片墙封面另见[设置封面](/zh/p/image-wall/#设置封面)。
