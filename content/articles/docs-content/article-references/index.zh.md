---
title: 02 怎么在多栏目引用文章？
date: 2026-11-17
lastmod: 2026-11-17
url: p/article-references/
description: 在目标栏目引用已有文章，正文只维护一份。
---

通过栏目文章引用，可以把同一篇文章加入多个分类。

## 添加引用

1. 按[创建栏目](/zh/p/directories/)准备目标栏目，例如 `content/articles/notes/`。
2. 在目标栏目创建或编辑 `_map.toml`，将已有文章的内容路径加入 `refs`。
3. 保存后运行 `swban dev`，打开目标栏目。

```toml
refs = ["/articles/product-info/banyan"]
```

已有 `refs` 时，在原数组中添加路径。路径相对于内容树，省略语言、域名和文件扩展名；例如上例对应 `content/articles/product-info/banyan/index.zh.md`。

## 检查结果

在中文目标栏目中打开引用，确认进入原文章，面包屑列显示本次浏览来源。其他语言使用同一份引用配置，各语言显示已有译文。

原文移动后，更新引用路径。保留原文的 `url` 可保持发布网址。含引用的栏目及其祖先使用 `build.list: always` 或 `local`，以便列出内容。

多个子栏目引用同一篇文章时，汇总列表和 RSS 各收录一次。产品展示见[收录产品](/zh/p/products/)。
