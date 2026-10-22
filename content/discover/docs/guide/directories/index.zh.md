---
title: 目录与引用
url: p/directories/
description: 用真实目录组织正文，用共享引用将文章加入其他栏目。
---

## 用目录组织正文

“发现 - 分类”来自普通目录 `content/discover/`。它与工具目录使用相同的成员和引用机制。
正文放在所属目录中，栏目列表直接使用这些文件。需要把同一篇文章列入其他栏目时，
在目标栏目放入 `_map.toml`，引用原文。

```text
content/discover/
├─ docs/
│  ├─ _index.zh.md
│  └─ guide/
│     ├─ _index.zh.md
│     └─ getting-started/
│        ├─ index.md
│        ├─ index.zh.md
│        └─ index.zh-tw.md
└─ learn/
   ├─ _index.md
   ├─ _index.zh.md
   ├─ _index.zh-tw.md
   └─ _map.toml
```

有子文章的栏目使用 `_index.<lang>.md`，其中的标题、介绍和正文属于该栏目。
单篇文章可以使用 `name.<lang>.md`，也可以使用 `name/index.<lang>.md` 叶子包。
`index.<lang>.md` 表示一篇文章，不用于容纳下级文章的栏目。
默认语言文件可以省略语言后缀。

栏目布局和文章布局由上级 `cascade` 继承，无须为每篇文章再写分类字段。
列表配置见 [列表与产品声明](/zh/p/collection-lists/)。

每篇正文直接声明固定网址，例如 `url: p/getting-started/`。
各语言保留自己的语言前缀；移动正文或修改标题时，保留 `url` 即可保持发布网址。
正文的最终输出路径必须唯一；根配置用 Hugo 原生 `printPathWarnings` 和
`panicOnWarning` 检查冲突。冲突时修改其中一篇的 `url`。
栏目页仍使用目录网址。新增顶层正文栏目无需追加路由配置。

## 引用到其他栏目

例如 `content/discover/learn/_map.toml`：

```toml
refs = ["/discover/docs/guide/getting-started"]
```

路径指向内容，不写语言、域名或文件扩展名。一份 `_map.toml` 供同目录各语言栏目共用。
主题按当前语言找到原文，再读取原文标题、描述、日期、图标和实际网址。
该语言没有原文时，这一语言不显示该引用。

文章的主要归属由实际目录确定，额外归属由引用它的栏目确定。
文章元信息列出实际目录路径和额外栏目路径；从引用栏目进入时，路径导航显示该来源。
正文始终只有一个地址，不生成引用页或正文副本。移动原文后，需要更新引用路径。

含 `_map.toml` 的栏目及其祖先须使用 `build.list: always` 或 `local`。
第一列入口仍由 `root_nav` 控制。`_map.toml` 与其他资源一样遵循 Hugo 的
`build.publishResources` 设置；设为 `true` 时也会发布该文件。

目录数量、更新时间、汇总列表和栏目 RSS 使用同一份递归成员集合。
同一篇文章经不同子栏目汇总到共同祖先时，只显示、计数和订阅一次。
`sitemap.xml` 与 `llms.txt` 收录真实页面，不为引用创建新条目。

## 工具目录

工具目录同样使用真实文章和 `_map.toml`。例如在
`content/tools/free/_map.toml` 引用已有工具正文：

```toml
refs = ["/discover/example-tool"]
```

Module 提供 `tools` 普通目录和 `all-tools` 汇总入口。
工具子目录默认使用产品列表；正文的 `offer` 只提供价格和价值说明，不控制收录。
详见 [怎样收录工具](/zh/p/collection-lists/#怎样收录工具)。

演示站根配置保留空的 `[taxonomies]`，关闭 Hugo 默认的 `tags` 和 `categories`。
目录与引用不依赖原生 taxonomy。
