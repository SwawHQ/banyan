---
title: 03 写第一篇文章
date: 2026-11-17
lastmod: 2026-11-17
url: p/first-article/
description: 创建一篇中文文章，添加图片并检查发布状态。
---

## 创建文章

在站点根目录使用[开始使用](/zh/p/getting-started/#取得站点)中定义的 `swban` 简称。正在预览时，先按 **Ctrl+C** 停止预览。

```powershell
swban base/hugo new content --kind banyan articles/my-post/index.zh.md  #创建中文文章
```

打开生成的 `content/articles/my-post/index.zh.md`：

1. 填写 `title` 和 `description`，在第二条 `---` 后写正文。正文小节从 `##` 开始。
2. 检查 `url`，例如 `p/my-post/`。以后移动文件时保留它，可以保持发布网址。
3. 准备公开时，将 `draft: true` 改为 `draft: false`，或删除 `draft` 字段。
4. 运行 `swban dev`，在中文文章栏目中打开新文章。

图片放在文章同一目录中，例如 `photo.jpg`，正文可写 `![图片说明](photo.jpg)`。分类方法见[创建栏目](/zh/p/directories/)和[栏目文章引用](/zh/p/article-references/)。

## 检查结果

确认标题、正文和图片显示正确。正式构建会排除草稿。

## 下一步

- 整理文章：先[创建栏目](/zh/p/directories/)，再按需要[在多个栏目引用文章](/zh/p/article-references/)。
- 发布站点：按[构建和检查](/zh/p/deploying/)生成产物，再选择发布平台。
