---
title: 03 怎么把首页改成图片墙？
date: 2026-11-17
lastmod: 2026-11-17
url: p/home-wall/
description: 让首页汇总指定栏目及其下级文章的封面。
---

## 修改首页

1. 打开中文首页 `content/_index.zh.md`。
2. 将 `layout` 改为 `page-collection-wall-all`。
3. 在已有 `params` 中设置 `aggregate` 和 `wall`，保留首页其他配置。

```yaml
layout: page-collection-wall-all
params:
  aggregate: /articles
  wall:
    size:
      width: auto
      height: 200
    details: title
    scroll: horizontal
```

上例汇总 `/articles` 及其下级文章和引用，同一篇文章显示一次，按发布日期倒序排列。页面显示文章卡片；子栏目入口可从根导航列访问。

封面设置见[图片墙封面](/zh/p/image-wall/#设置封面)，排列方式见[图片墙排列](/zh/p/wall-layout/)。普通汇总栏目也可采用这套配置。

## 检查结果

运行 `swban server`，打开各语言首页，确认出现文章封面且链接可访问。`params.show_navigation` 继续控制首页根导航列。

## 切回艺术首页

将布局改回 `page-root-navigation`，移除 `aggregate` 和 `wall`，根地址即恢复为导航列。风场仍可从首页入口访问。
