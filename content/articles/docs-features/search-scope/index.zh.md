---
title: 搜索：怎么设置搜索范围？
date: 2026-11-17
lastmod: 2026-11-17
url: p/search-scope/
description: 选择搜索收录的页面和正文范围，并重新生成索引。
---

## 选择页面范围

打开各语言的 `content/search/_index*.md`，修改已有的 `params.index`。参考站按当前语言的首页 RSS 收录文章：

```yaml
params:
  index:
    source: rss
    selector: ".article .prose"
```

`rss` 使用首页 RSS 的实际条目，包括订阅条数限制。调整 RSS 后，搜索收录也会变化，见[RSS 订阅](/zh/p/rss-subscriptions/)。

要搜索指定发布目录中的页面，可将 `source` 改为目录或文件匹配规则：

| source 示例 | 收录范围 |
| --- | --- |
| `"p/"` | 当前语言发布根目录下 `p/` 中的全部 HTML |
| `"*.html"` | 当前语言发布根目录直属的 HTML |
| `"**/*.html"` | 从当前语言发布根目录递归查找 HTML |
| `["p/", "notes/**/*.html"]` | 合并多个目录或匹配规则 |

这里使用发布路径。例如中文的 `"p/"` 对应 `/zh/p/`，而非 `content/` 中的文件位置。默认语言位于站点根目录时，递归规则也会选中其他语言子目录；搜索结果仍按页面语言分组。

文件范围由路径和下方选择器决定。`noindex` 和 sitemap 排除设置不会自动过滤这类索引，需在选择范围时排除相应内容。

## 选择页面中的内容

`selector` 指定提取哪些 HTML 内容。参考值 `.article .prose` 提取文章正文，避免把导航文字加入搜索。使用现有的 class、id 或属性选择器，各语言保持相同值。

## 重新生成索引

在站点根目录运行：

```text
swban build  #构建页面和搜索索引
swban server    #启动本地预览并建立搜索索引
```

两条命令按用途选择。预览中修改内容后，重启 `swban server` 更新搜索索引。正式发布时上传完整构建产物，其中包含 `pagefind/`。

## 检查结果

打开每种语言的搜索页，搜索一篇应被收录的文章，再检查一篇应被排除的页面。确认结果指向当前语言的正确文章。

新增搜索语言时，从参考站复制对应搜索页面，保留 `layout: page-search`、`outputs: [HTML]`、图标和提示文案，再修改译文。
