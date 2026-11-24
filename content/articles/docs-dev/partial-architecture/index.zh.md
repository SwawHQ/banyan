---
title: 02 项目结构与源码入口
date: 2026-11-06
lastmod: 2026-11-24
url: p/partial-architecture/
description: 说明主题目录、模块所有权、依赖方向和维护入口。
---

## 页面入口

以下路径相对 `module/`。

| 目录或入口 | 职责 |
| --- | --- |
| `layouts/baseof.html` | 页面整体装配 |
| `layouts/page-*.html` | 内容选择的页面布局 |
| `layouts/_partials/` | 入口私有模板、功能模板与系统机制 |
| `layouts/_shortcodes/` | 正文短代码 |
| `layouts/_markup/` | Markdown 渲染 |
| `layouts/rss.xml`、`sitemap.xml`、`home.llms.txt` | 订阅与站点发现输出 |
| `assets/js/`、`assets/css/` | 浏览器行为与样式 |

`page-*` 是布局命名，不表示 Hugo 的 page 类型。集合布局用于普通栏目；首页另支持汇总图片墙。当前没有 taxonomy 和 term 的列表布局。配置方法见[列表显示方式](/zh/p/collection-lists/)。

## Partial 所有权

| 目录（相对 `layouts/_partials/`） | 职责 |
| --- | --- |
| `entry-baseof/`、`entry-page-home/` | 入口独有的装配与检查 |
| `feature-browse/` | 内容成员、引用、列表、图片墙和导航 |
| `feature-document/` | 正文、元信息、章节与文章结构化数据 |
| `feature-preferences/` | 语言和外观选项 |
| `page-powered-by/`、`feature-prefetch-debug/`、`feature-site-status/` | 诊断与状态显示 |
| `system-ui/` | 公共列表、图标、控件与页面样式 |
| `system-assets/` | 资源定位、处理、构建与发布 |
| `system-metadata/` | SEO、分享信息和 Agent 索引 |
| `system-delivery/` | SW、预取、缓存与部署配置 |
| `system-build/` | 站点构建版本与时间 |

## 依赖方向

入口组合功能与系统模块；功能模块可以使用系统模块，系统模块不反向读取功能状态。跨功能依赖保持明确、单向，例如文章元信息读取内容归属。

公共 UI 接收功能模块生成的字段与链接，不负责发现成员。资源构建接收调用者指定的资源，不自行读取浏览来源。SEO 消费构建期模型，不以浏览器来源作为规范路径。

新增代码先放在所属入口或功能附近，出现实际复用后再提取。不要为目录对称增加空层或转发模板。

## 功能内部边界

| 重要约定 | 源码入口（相对 `layouts/_partials/`） |
| --- | --- |
| 列表、计数、RSS 与反向引用共用成员索引 | `feature-browse/directory/index.html` |
| 引用不创建页面，不改变 Parent 与正文网址 | `feature-browse/directory/` |
| 结构路径与浏览来源分别维护 | `feature-browse/navigation/` |
| 资源定位与发布分开，衍生图不必额外发布源图 | `system-assets/resolve-page.html`、`publish-page.html` |
| 共享列表只装配公共控件 | `system-ui/list/` |
| 内联脚本与 CSP 使用同一份最终正文 | `entry-baseof/inline-scripts.html`、`system-delivery/deployment/csp-value.html` |

站点发现使用实际发布页面；引用不会产生新的规范地址。LLMS 可以把同一正文列入真实栏目和引用栏目，规则见[站点发现](/zh/p/discovery/)。

导航模型见[面包屑导航模型](/zh/p/breadcrumb-models/)，网址状态见[导航状态协议](/zh/p/navigation-state/)，组件与样式入口见[UI 命名与职责](/zh/p/ui-naming/)。本地运行与检查入口见[本地开发](/zh/p/local-development/)。

## 下一步

按改动范围从[开发主题](/zh/articles/docs-dev/)选择约定和检查。局部实现说明在对应源码附近。
