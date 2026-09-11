# Banyan Taxonomies

## 默认模型

Banyan 推荐用两层结构组织内容：

- 目录树 / section：主结构，回答“它放在哪一枝上”
- `tags`：主题分类，回答“它涉及哪些领域”

站点根配置：

```toml
[taxonomies]
tag = "tags"
```

一篇文章可以属于多条独立路径：

```yaml
tags:
  - ai
  - tooling/devtools/windows
```

Hugo 原生把每个 taxonomy term 当成独立字符串。Banyan 约定用 `/` 表达路径，并在界面中把这些字符串渲染成树。

## 就地定义

Banyan 不提供 taxonomy 名称或渲染配置的通用兜底。每个 taxonomy 由站点自己的 branch bundle 定义：

- `content/<plural>/_index.<lang>.md`：定义 taxonomy 根页及 Banyan 渲染参数
- `content/<plural>/<term>/_index.<lang>.md`：定义 term 页的标题、正文和页面资源

taxonomy 必须先在站点根 `hugo.toml` 的 `[taxonomies]` 中声明。仅创建同名内容目录只会得到普通 section。

根 bundle 契约：

- 必须提供非空 `title`
- 可选 `linkTitle` 作为导航、breadcrumb、列表和文章元信息中的短名称；未填写时回退到 `title`
- 必须提供 `[banyan_taxonomy]`
- 必须显式填写 `mode`、`article_weight`、`normalize`、`article_mode`
- 第一列是否显示来自页面的 `root_nav`，顺序来自页面 `weight`

示例：

```yaml
---
title: "Content - Categories"
linkTitle: "Content - Categories"
root_nav: true

banyan_taxonomy:
  mode: tree
  article_weight: 30
  normalize: lower
  article_mode: leaf_paths
  term_rel: tag
  unassigned_term: untagged
  unassigned_label: --untagged--
---
```

## 树形路径与文章归属

`mode: tree` 把 `/` 分隔的 term 作为路径渲染。若文章声明：

```yaml
tags:
  - tooling/devtools/windows
```

则 `tooling`、`tooling/devtools` 和 `tooling/devtools/windows` 都需要对应语言的 term bundle。文章归在最深的 `windows` 节点，祖先节点通过子树汇总仍可找到它。

当一篇文章声明多条路径时，Banyan 保留每条互不包含的叶子路径，只省略已被后代覆盖的祖先：

```yaml
tags:
  - tooling
  - tooling/devtools/windows
  - tooling/servers/linux
  - ai
```

文章元信息为 `tooling/devtools/windows`、`tooling/servers/linux` 和 `ai` 各生成一行，并在每行显示从 taxonomy 根到终点的完整可点击路径；行首 taxonomy 名称链接到 taxonomy 根页。显式填写的 `tooling` 被第一条更深路径覆盖，因此不单独生成终点行；它仍作为两条完整路径中的祖先节点显示。两个兄弟分支都保留。分类页使用同一条叶子规则决定文章的直接归属。

`article_mode` 支持：

- `all`：每个声明值生成一条文章元信息行
- `leaf_paths`：树形 taxonomy 中每个叶子生成一行完整路径，省略已被后代覆盖的祖先终点行
- `none`：不在文章元信息中显示该 taxonomy

## 渲染参数

`mode` 支持：

- `flat`：把所有 term 作为同一层展示
- `tree`：按 `/` 路径展示层级

`normalize` 支持：

- `identity`：保留原值比较
- `lower`：用小写值比较路径

可选参数：

- `term_rel`：文章 term 链接的 `rel` 值
- `require_term_bundles`：是否要求每个 term 和树形祖先都存在显式 bundle，默认为 `true`
- `unassigned_term`：没有填写该 taxonomy 的文章所进入的虚拟 term
- `unassigned_label`：未分类 term 的显示名称

`[banyan_taxonomy].label` 与 `home_label` 已移除；完整名称来自 `title`，短名称来自 `linkTitle`。

## Term bundle

例如 `content/tags/tooling/devtools/_index.zh.md`：

```yaml
---
title: "开发工具"
description: "浏览提升开发、调试、部署与维护效率的工具和实战指南。"
---
```

`title` 必填。只有完整标题不适合紧凑界面时才需要额外填写 `linkTitle`。

## 自定义 taxonomy

其他 taxonomy 使用同一契约。先在站点根配置注册，再建立对应的 root bundle。例如：

```toml
[taxonomies]
tag = "tags"
author = "authors"
```

```yaml
---
title: "Authors"

banyan_taxonomy:
  mode: flat
  article_weight: 40
  normalize: lower
  article_mode: all
---
```

新增 taxonomy 的顺序是：

1. 在站点根 `[taxonomies]` 中声明单数键和复数值。
2. 创建 `content/<plural>/_index.<lang>.md` 并填写完整根 bundle 契约。
3. 为内容使用的 term 创建对应语言的 bundle；树形 taxonomy 还要创建每层祖先。
4. 需要说明文字、图标或局部资源时，再放入对应 term bundle。
