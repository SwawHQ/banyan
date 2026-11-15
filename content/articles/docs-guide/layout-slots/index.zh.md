---
title: 外观 · 页面区域与导航
date: 2026-11-06
lastmod: 2026-11-15
url: p/layout-slots/
description: 添加根导航入口，选择面包屑区域和文章辅助内容。
---

## 第一列入口

根导航列显示当前语言的首页和已发布的直属页面。新增入口时，在 `content/` 下创建根栏目或独立页面，并设置名称、顺序和图标：

```yaml
title: 关于
weight: 90
params:
  icon: {text: "©"}
```

入口名称优先使用 `linkTitle`，未设置时使用 `title`；顺序使用入口自身的 `weight`，不要向全部文章继承这个值。图标配置见[列表与产品声明](/zh/p/collection-lists/#怎样声明条目图标)。

内部页面可用 `build.list: never` 隐藏入口。删除根页面也会移除对应入口。首页在 `content/_index*.md` 中配置；`params.show_navigation` 控制首页是否显示根导航列。

从引用栏目进入文章时，导航显示该次来源；直接打开文章时，显示文章默认归属。正文仍使用同一发布网址，见[目录与引用](/zh/p/directories/)。

## 站点说明页与外部链接

关于、GitHub 等说明页使用 `page-article-norss`，避免进入文章 RSS。参考文件在 `content/about/` 和 `content/github/`；修改各语言正文和链接即可。

外部目标放在说明页正文中。需要在新标签打开时使用短代码：

```text
{{</* new-tab href="https://example.com/" */>}}访问网站{{</* /new-tab */>}}
```

正文内的小图标可用 `asset` 短代码，并设置 `class="md-inline-image"`。例如，页面包中有 `badge.webp` 时：

```text
{{</* asset src="badge.webp" alt="图标说明" class="md-inline-image" width="16" height="16" */>}}
```

RSS 说明页与订阅开关见[RSS 订阅](/zh/p/discovery/#rss-订阅)。

## 支持的 slots

页面的 `params.slots` 选择需要的区域。省略名称会关闭对应区域，`[]` 关闭全部可选区域。根导航列和正文不由此项控制。

| 名称 | 开启的内容 |
| --- | --- |
| `breadcrumb` | 面包屑列和面包屑结构化数据（BreadcrumbList） |
| `meta` | 文章元信息、章节目录和文章结构化数据（BlogPosting） |

省略 `meta` 会同时关闭这三部分。页内“目录与信息”按钮只展开或收起辅助内容，不改变结构化数据输出。

## 推荐写法

栏目与汇总列表页：

```yaml
params:
  slots: [breadcrumb]
```

文章页：

```yaml
params:
  slots: [breadcrumb, meta]
```

可在上级栏目的 `cascade` 中按页面类型设置默认值，无需逐篇填写。文章和列表布局见[列表与产品声明](/zh/p/collection-lists/)。

语言和外观页由站点维护，分别使用 `page-collection-language`、`page-collection-appearance`，并声明 `outputs: [HTML]`。离线页使用 `page-offline`。可从参考站点复制对应页面文件，布局由主题提供。

## 与导航状态和布局的边界

`params.slots` 是页面配置；浏览来源和排序随访问网址保留，无需写入页面配置。

各屏幕宽度使用同一横向画幅，各页面列独立纵向滚动。章节链接可用于直接定位正文。外观和首页定制见[配色与首页定制](/zh/p/appearance-customization/)。

开发者修改布局时，参见[公共页面列](/zh/p/ui-naming/#公共页面列)；修改浏览来源与排序时，参见[导航状态协议](/zh/p/navigation-state/)。
