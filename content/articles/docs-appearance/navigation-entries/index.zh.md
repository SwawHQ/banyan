---
title: 10 怎么调整导航入口？
date: 2026-11-17
lastmod: 2026-11-17
url: p/navigation-entries/
description: 添加根导航入口，修改名称、顺序和显示状态。
---

## 添加入口

根导航列显示当前语言已发布的直属页面，包括 `content/home/`。添加文章分类时，按[创建栏目](/zh/p/directories/)在 `content/` 下建立顶层栏目。添加独立说明页时，可参考现有的 `content/about/`。

例如，新建 `content/contact/index.zh.md`：

```yaml
---
title: 联系方式
url: contact/
weight: 130
layout: page-article-norss
params:
  icon: {text: "@"}
  slots: [breadcrumb]
---
```

在页面元数据之后写正文。需要其他语言入口时，在同一目录添加对应的 `index*.md`。

## 收起导航列

再次点击根导航中已选中的条目，回到当前语言的根地址。在后续导航列中，再次点击已选中的条目，会回到该列的列表并保留排序。复制链接或在新标签页打开，仍会进入条目本身。

## 修改名称和顺序

编辑入口页面自己的字段：

| 字段 | 用途 |
| --- | --- |
| `title` | 页面标题，也是默认入口名称 |
| `linkTitle` | 单独设置入口名称 |
| `weight` | 根导航顺序，数值较小的排在前面 |
| `params.icon` | 入口图标，见[条目图标](/zh/p/item-icons/) |

`weight` 设置在入口本身。栏目内部的条目顺序使用[默认排序](/zh/p/list-sorting/)。

## 隐藏入口

在目标页面的元数据中设置：

```yaml
build:
  list: never
```

页面仍可通过网址访问，但会从内容列表中隐藏；搜索引擎收录另见[收录设置](/zh/p/discovery/)。

使用图片墙布局时，要隐藏根导航，在 `content/_index*.md` 中设置 `params.show_navigation: false`。恢复显示时改为 `true`。

## 添加说明页链接

外部网址写在说明页正文中。需要新标签打开时使用：

```text
{{</* new-tab href="https://example.com/" */>}}访问网站{{</* /new-tab */>}}
```

正文中的小图标可以使用页面包图片，例如：

```text
{{</* asset src="badge.webp" alt="图标说明" class="md-inline-image" width="16" height="16" */>}}
```

## 检查结果

运行 `swban server`，打开各语言首页，确认入口名称、顺序和图标正确，点击后可打开目标页面。说明页使用 `page-article-norss`，文章订阅中不会收录该页。
