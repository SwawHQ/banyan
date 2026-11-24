---
title: 界面：UI 命名与职责
date: 2026-11-06
lastmod: 2026-11-24
url: p/ui-naming/
description: 说明页面列、公共列表和样式的职责边界与源码入口。
---

概念名称见[项目术语表](/zh/p/glossary/)。本文用于定位 UI 源码；配置示例见[开始使用](/zh/articles/docs-start/)。

## 公共页面列

文档承载横向画幅，各页面列独立纵向滚动。根导航列、面包屑列、主内容列和文档辅助列使用同一布局体系；DOM 顺序与阅读顺序保持一致。

`module/assets/css/page-shell.css` 负责列尺寸、滚动和打印布局，`breadcrumb-navigation.css` 与 `document-aside.css` 负责各自列内呈现。正文表格和代码的局部滚动不作为页面列。

修改面包屑列时，保留已有滚动容器，避免重置画幅。实现入口为 `module/assets/js/browse/breadcrumb-render.js`；首帧位置与历史边界见[面包屑导航模型](/zh/p/breadcrumb-models/#布局与维护边界)。

## 样式类与行为标记

样式类表达呈现，`data-*` 表达脚本行为，ARIA 表达可访问语义。修改其中一类时，核对另外两类及共享片段读取端。

公共列表与完整条目由 `module/layouts/_partials/system-ui/list/` 提供。功能模块决定成员、字段和链接，公共组件只负责装配。根导航、主列表、选择列表与共享导航片段复用条目组件。

链接与按钮保持原生控件，保留键盘操作、焦点和可访问名称。选择列表与可排序列表使用各自功能入口，不把业务判断放入公共控件。

## CSS 源码与发布名

CSS 按视觉职责命名，不复制模板目录层级。源码职责与发布资源可以不同；依赖和合并顺序直接读取构建入口，避免另维护一份文件清单。

以下路径相对 `module/`。

| 修改内容 | 入口 |
| --- | --- |
| 公共样式与配色装配 | `assets/css/page.css`、`layouts/_partials/system-ui/page-styles.html` |
| 页面画幅与列尺寸 | `assets/css/page-shell.css` |
| 列表字段、控件与图标 | `assets/css/list-layout.css`、`item.css`、`icons.css` |
| 正文样式 | `assets/css/prose.css`、`layouts/_partials/feature-document/styles.html` |
| 元信息与章节目录 | `layouts/_partials/feature-document/`、`assets/css/document-aside.css` |
| 共享面包屑 HTML | `layouts/_partials/feature-browse/navigation/source/fragment.html` |
| 共享片段校验与显示 | `assets/js/browse/breadcrumb-source.js`、`breadcrumb-render.js` |
| 语言与外观选项 | `layouts/_partials/feature-preferences/`、`assets/js/preferences/` |
| 站点状态控件 | `layouts/_partials/page-powered-by/status-value.html`、`assets/js/site-status/` |
| 首页艺术包装配 | `layouts/page-home.html`、`layouts/_partials/entry-page-home/` |

Module 提供内置配色，站点维护自定义配色与艺术包，修改方法见[首页和外观](/zh/articles/docs-appearance/)。浏览来源与排序只在[导航状态协议](/zh/p/navigation-state/)中定义；不要用 UI 命名或样式类替代该协议。
