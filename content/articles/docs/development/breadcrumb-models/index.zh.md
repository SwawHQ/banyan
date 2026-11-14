---
title: 面包屑导航模型
date: 2026-11-06
lastmod: 2026-11-14
url: p/breadcrumb-models/
description: 说明内容归属、构建模型与共享导航片段的边界。
---

## 第一列与进入路径

根导航列来自当前语言的首页和直属页面。结构根页面用于归属判断，可见入口只保留已发布 HTML 的页面；根入口可以是栏目，也可以是普通页面。

内容声明见[页面区域与布局](/zh/p/layout-slots/)。构建入口为 `module/layouts/_partials/feature-browse/navigation/root/`。

## 选中规则

默认归属来自真实内容祖先。`_map.toml` 增加引用关系，不创建新页面，也不修改原文的 Parent 或发布网址。

浏览来源只改变本次导航。来源有效性、排序与历史规则统一见[导航状态协议](/zh/p/navigation-state/)，不能据此改变规范地址或结构化数据中的真实路径。

## 面包屑模型

构建期区分路径项与列来源：路径项表示目标页面，列来源提供该级的同级条目。Hugo Page 只用于构建，不传入浏览器。

根导航、主列表与正文保留在页面 HTML 中。面包屑内容生成共享 HTML 片段，页面只携带所需列索引。共享片段提供内容和默认排序，不保存用户状态。

以下路径相对 `module/`。

| 修改内容 | 入口 |
| --- | --- |
| 真实路径与结构面包屑 | `layouts/_partials/feature-browse/navigation/breadcrumb/model.html` |
| 列模型与共享片段 | `layouts/_partials/feature-browse/navigation/source/models.html`、`fragment.html` |
| 片段发布与页面索引 | `layouts/_partials/feature-browse/navigation/source/publish.html`、`pack.html` |
| 索引读取与来源选择 | `assets/js/browse/navigation-source.js` |
| 片段校验、加载与显示 | `assets/js/browse/breadcrumb-source.js`、`breadcrumb-controller.js`、`breadcrumb-render.js` |

## 布局与维护边界

骨架须在片段加载前预留列宽。后续填充或排序复用已有容器；失败时显示说明，无效来源回到默认路径。DOM 与样式归属见[UI 命名与职责](/zh/p/ui-naming/)。

`assets/js/browse/canvas-position.js` 与 `assets/js/inline/canvas-position.js` 处理同标签页进入下一文档时的横向位置。已有滚动位置、章节锚点与用户输入优先，历史恢复交给浏览器。

修改后按[浏览器检查](/zh/p/browser-regression/)选择来源、排序、章节、画幅和历史场景。浏览器层的下拉刷新差异仍需真机检查。
