---
title: 收录：怎么生成 llms.txt？
date: 2026-11-17
lastmod: 2026-11-17
url: p/agent-index/
description: 启用按语言生成的内容目录，检查收录条目。
---

## 启用内容目录

在 `hugo.toml` 的 `[outputs]` 中，将 `LLMS` 加入已有的 `home` 数组。例如：

```toml
[outputs]
home = ["HTML", "RSS", "LLMS"]
```

保留本站使用的其他输出。参考站已提供 `LLMS` 输出格式定义。

## 设置目录内容

各语言的 `llms.txt` 与 sitemap 使用相同收录范围，按栏目组织页面。编辑页面的 `title` 和 `description` 可更新目录中的名称和说明。分类引用可以使同一篇正文出现在多个相关栏目中。

调整收录范围见[站点收录](/zh/p/discovery/)。从 `home` 数组移除 `LLMS` 可停用内容目录；爬虫访问规则仍由 `robots.txt` 管理。

## 检查结果

按[构建教程](/zh/p/deploying/#构建与检查)生成产物后运行：

```text
swban check/llms "$build"  #检查内容目录和链接
```

打开各语言首页路径下的 `llms.txt`。参考站英语地址为 `/llms.txt`，中文为 `/zh/llms.txt`。确认栏目、文章和语言链接完整。
