---
title: 11 怎么设置文章辅助内容？
date: 2026-11-06
lastmod: 2026-11-17
url: p/layout-slots/
description: 设置面包屑列、文章元信息和章节目录。
---

## 选择显示内容

打开文章的 `index*.md`，修改已有的 `params.slots`。例如，显示面包屑列、文章元信息和章节目录：

```yaml
params:
  slots: [breadcrumb, meta]
```

| slots 值 | 显示内容 |
| --- | --- |
| `[breadcrumb, meta]` | 面包屑列、文章元信息和章节目录 |
| `[breadcrumb]` | 面包屑列 |
| `[meta]` | 文章元信息和章节目录 |
| `[]` | 关闭这些可选区域 |

保留根导航列和正文。根导航入口及首页的整列开关见[导航设置](/zh/p/navigation-entries/)。

`meta` 同时控制文章元信息、章节目录和文章结构化数据（BlogPosting）；`breadcrumb` 同时控制面包屑列和面包屑结构化数据（BreadcrumbList）。关闭对应区域时，相关结构化数据也随之关闭。

## 为栏目下的文章统一设置

在上级栏目的 `_index*.md` 中，修改已有的页面配置继承规则。例如：

```yaml
cascade:
  - target: {kind: page}
    params:
      slots: [breadcrumb, meta]
```

已有 `cascade` 时，将 `slots` 合并到对应规则，保留其中的布局等设置。单篇文章可用自己的 `params.slots` 覆盖继承值；删除该字段后恢复继承。

栏目与汇总列表通常使用 `slots: [breadcrumb]`。

## 检查结果

运行 `swban server`，打开一篇含二级标题的文章。确认面包屑列和“目录与信息”按钮符合设置，展开后能看到文章元信息和章节目录。

读者点击“目录与信息”按钮可临时展开或收起辅助内容，结构化数据输出仍由页面配置决定。修改主题布局见[UI 约定](/zh/p/ui-naming/)，浏览来源见[导航状态](/zh/p/navigation-state/)。
