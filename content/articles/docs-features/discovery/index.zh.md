---
title: 收录：怎么控制站点收录范围？
date: 2026-11-06
lastmod: 2026-11-17
url: p/discovery/
description: 设置 sitemap、搜索引擎索引提示和爬虫规则。
---

## 从站点地图排除页面

编辑目标页面的 `index*.md`，加入：

```yaml
sitemap:
  disable: true
```

排除整个栏目及其后代时，在栏目的 `_index*.md` 中设置 `cascade.sitemap.disable: true`。已有 `cascade` 时合并到适用规则。页面仍可正常访问，搜索引擎也可能通过其他链接发现它。

## 请求搜索引擎不索引

在页面已有的 `params` 中设置：

```yaml
params:
  robots: noindex, follow
```

此项向搜索引擎发送不索引提示，同时从 Banyan 的 sitemap、`llms.txt` 和其他页面的替代语言链接中排除该页。页面仍可通过网址访问；私有内容应使用托管平台的访问控制。

`build.list` 控制内容列表。仅将页面从导航隐藏时，可索引的页面仍会进入站点地图。

## 设置爬虫规则

默认规则允许所有爬虫访问。要自定义规则，将 Module 的 `assets/site/robots.txt.tmpl` 复制到站点同路径，按目标爬虫填写 `User-agent`、`Allow` 和 `Disallow`，并保留 sitemap 地址。`hugo.toml` 的 `enableRobotsTXT` 控制是否生成该文件。

需要搜索引擎读取 `noindex` 时，应允许它抓取该页面。站内搜索有独立的[索引范围](/zh/p/search-scope/)。

## 检查结果

按[构建教程](/zh/p/deploying/#构建与检查)生成产物后运行：

```text
swban check/sitemap "$build"  #检查站点地图
swban check/llms "$build"     #检查内容目录
```

查看产物中的各语言 `sitemap.xml`、`llms.txt` 和页面 robots 元信息，确认目标页面的收录状态。结构化数据的名称和含义见[项目术语表](/zh/p/glossary/#结构化数据)。
