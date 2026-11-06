---
title: 目录与引用
date: 2026-11-06
lastmod: 2026-11-06
url: p/directories/
description: 用真实目录组织正文，用共享引用将文章加入其他栏目。
---

## 用目录组织正文

栏目名称由站点定义。Banyan 最小演示用 `articles`、`articles-all` 展示文章分类与全部列表，
用 `products`、`products-all` 展示产品分类与全部列表。列表与产品示例共用一篇正文和一份 `_map.toml`；文档和变更记录也在 `articles` 下维护。Swaw 的 `d`、`d-all`、`pr` 和 `pr-all` 是该站点的定制内容，Module 不提供这些入口。

正文放在所属目录中，栏目列表直接使用这些文件。需要把同一篇文章列入其他栏目时，
在目标栏目放入 `_map.toml`，引用原文。

```text
content/
├─ articles/
│  ├─ _index.md
│  └─ category1/
│     ├─ _index.md
│     └─ example/
│        └─ index.md
├─ articles-all/
│  └─ _index.md
├─ products/
│  ├─ _index.md
│  └─ examples/
│     ├─ _index.md
│     └─ _map.toml
└─ products-all/
   └─ _index.md
```

示例省略同路径的中文译文。有子文章的栏目使用 `_index.<lang>.md`，其中的标题、
介绍和正文属于该栏目。单篇文章统一使用 `name/index.<lang>.md` 叶子包，
文章资源放在同一目录。`index.<lang>.md` 不用于容纳下级文章的栏目。
默认语言文件可以省略语言后缀。

文章模板由站点根 `archetypes/banyan.md` 维护，Module 和传统主题目录不提供。

```text
swban base/hugo new content --kind banyan articles/my-post/index.md  #新建文章
```

栏目布局和文章布局由上级 `cascade` 继承，无须为每篇文章再写分类字段。
列表配置见 [列表与产品声明](/zh/p/collection-lists/)。

每篇正文直接声明固定网址，例如 `url: p/example-product/`。
各语言保留自己的语言前缀；移动正文或修改标题时，保留 `url` 即可保持发布网址。
正文的最终输出路径必须唯一；根配置用 Hugo 原生 `printPathWarnings` 和
`panicOnWarning` 检查冲突。冲突时修改其中一篇的 `url`。
栏目页仍使用目录网址。新增顶层正文栏目无需追加路由配置。

## 引用到其他栏目

例如 `content/products/examples/_map.toml`：

```toml
refs = ["/articles/category1/example"]
```

路径指向内容，不写语言、域名或文件扩展名。一份 `_map.toml` 供同目录各语言栏目共用。
主题按当前语言找到原文，再读取原文标题、描述、日期、图标和实际网址。
该语言没有原文时，这一语言不显示该引用。

文章的主要归属由实际目录确定，额外归属由引用它的栏目确定。
文章元信息列出实际目录路径和额外栏目路径；从引用栏目进入时，路径导航显示该来源。
正文始终只有一个地址，不生成引用页或正文副本。移动原文后，需要更新引用路径。

含 `_map.toml` 的栏目及其祖先须使用 `build.list: always` 或 `local`。
第一列默认显示已发布的直属页面。`_map.toml` 与其他资源一样遵循 Hugo 的
`build.publishResources` 设置；设为 `true` 时也会发布该文件。

目录数量、更新时间、汇总列表和栏目 RSS 使用同一份递归成员集合。
同一篇文章经不同子栏目汇总到共同祖先时，只显示、计数和订阅一次。
`sitemap.xml` 与 `llms.txt` 收录真实页面，不为引用创建新条目。

## 产品目录

产品目录同样使用真实文章和 `_map.toml`。Banyan 演示只在 `products/examples/` 放一份
`_map.toml`，引用 `/articles/category1/example`。该栏目从 `products` 根继承
`layout: page-collection-products`；`products-all` 使用 `page-collection-products-all` 并通过 `params.aggregate: /products` 汇总产品目录。
`articles-all` 使用 `page-collection-directory-all` 和 `params.aggregate: /articles`，汇总文章目录中的正文。

目录名和汇总入口可以修改。Swaw 使用 `pr` 与 `pr-all` 实现相同行为。
正文的 `params.offer` 只提供版本和价格，不控制收录。
详见 [怎样收录产品](/zh/p/collection-lists/#怎样收录产品)。

演示站根配置保留空的 `[taxonomies]`，关闭 Hugo 默认的 `tags` 和 `categories`。
目录与引用不依赖原生 taxonomy。
