---
title: 01 怎么创建栏目？
date: 2026-11-06
lastmod: 2026-11-17
url: p/directories/
description: 用栏目组织文章，按需要建立分类层级。
---

Banyan 用栏目层级组织分类。以下示例在“文章”下创建“笔记”栏目。

## 创建栏目

1. 创建 `content/articles/notes/`。
2. 在其中创建 `_index.zh.md`，写入下方内容。它继承参考站 `articles/` 的列表与文章布局。

```yaml
---
title: 笔记
description: 收录日常笔记。
---
```

其他语言在同一目录创建对应的 `_index.<语言代码>.md`；默认语言可省略语言后缀。新建顶层栏目时，还需配置布局及后代页面默认值，可复制参考站 `content/articles/_index*.md` 后修改标题、顺序与说明。

## 放入文章

按[写第一篇文章](/zh/p/first-article/)创建正文，把文章页面包放在 `content/articles/notes/` 下。已有文章也可通过[栏目文章引用](/zh/p/article-references/)收录。例如：

```text
content/articles/notes/
├─ _index.zh.md
└─ first-note/
   ├─ index.zh.md
   └─ photo.jpg
```

栏目使用 `_index.zh.md`，单篇文章使用独立页面包中的 `index.zh.md`。移动已有文章时，保留 `url`，并更新引用它的 `_map.toml`。

## 检查结果

运行 `swban dev`，打开中文文章栏目，确认“笔记”和其中的文章都可访问。

需要多维分类时，继续阅读[把文章加入多个栏目](/zh/p/article-references/)。列表呈现方式见[列表配置](/zh/p/collection-lists/)。
