---
title: 项目术语表
date: 2026-11-13
lastmod: 2026-11-14
url: p/glossary/
description: 统一项目用语，快速了解页面结构、内容分类、配置和交付机制。
---

对话和文档优先使用下表名称。机制名称带上作用范围；上下文明确时可用简称。对应标识用于查找配置或实现。

## 页面区域

| 术语 | 含义 | 对应标识 |
| --- | --- | --- |
| 根导航列 | 页面第一列，显示首页和已发布的根页面入口。 | `.page-rail` |
| 根入口 | 根导航列中的一个条目，指向首页、顶层栏目或独立根页面。 | `data-root-href` |
| 面包屑列 | 显示浏览路径中某一级栏目的条目，供用户选择同级内容。 | `.breadcrumb-column` |
| 主内容列 | 显示当前页面的文章、列表或其他主要内容。 | `.page-content` |
| 文档辅助列 | 容纳文章元信息和章节目录的页面列。 | `.document-aside` |
| 文章元信息 | 说明文章的目录归属、日期及相关链接等信息。 | `.document-meta` |
| 章节目录 | 由当前文章的章节标题组成的跳转列表。 | `.document-toc` |
| 主列表 | 当前集合页面在主内容列中显示的条目列表。 | `feature-browse/collection/render.html` |
| 结构面包屑 | 按页面真实内容层级生成的路径数据，用于 SEO 等输出。 | `BreadcrumbList` |
| 页面画幅 | 横向排列根导航列、面包屑列和阅读组的整体区域。 | `.page-shell` |
| 阅读组 | 将主内容列和文档辅助列组合在一起的布局区域。 | `.reading-group` |
| 图片墙 | 用封面卡片呈现分类或文章的集合视图。 | `page-collection-wall`、`page-collection-wall-all` |

区域配置见[页面区域与布局](/zh/p/layout-slots/)，组件和样式见 [UI 命名与职责](/zh/p/ui-naming/)。

## 内容与路径

| 术语 | 含义 | 对应标识 |
| --- | --- | --- |
| 分类 | 按主题或用途组织内容的方式，通过栏目层级和文章引用实现。 | 内容目录、`_map.toml` |
| 栏目 | 组织子栏目、文章和引用的内容节点。 | `_index.md`、`section` |
| 文章 | 保存一篇正文及其元信息的内容页面，也可用于介绍产品。 | `index.md`、`page-article-*` |
| 页面包 | 将页面文件与图片等资源放在同一目录中的内容单元。 | 含 `index.md` 或 `_index.md` 的目录 |
| 栏目文章引用 | 在栏目中收录已有文章，条目链接指向原文。 | `_map.toml` 中的 `refs` |
| 文章默认归属 | 由文章实际所在目录确定的栏目路径。 | 文章的内容祖先 |
| 多维分类 | 将同一篇文章放入多个分类路径；正文保存在文章默认归属下，其他栏目通过引用收录。 | `_map.toml`、`refs` |
| 汇总列表 | 汇集指定栏目及其子栏目中的文章和引用，同一篇文章计入一次。 | `params.aggregate`、`page-collection-*-all` |
| 汇总时间范围 | 按文章更新时间划分汇总内容的区间，包含起点，截止到终点之前。 | `params.time_range`、`Lastmod` |
| 内容路径 | 页面在内容树中的逻辑位置，例如 `/articles/category1/example`。 | `_map.toml` 引用路径、Hugo `.Path` |
| 发布网址 | 用户访问页面的地址，例如 `/zh/p/example-product/`。 | `url`、`.RelPermalink` |
| 文章浏览来源 | 用户进入文章时所经的栏目路径，用于呈现该次浏览的导航。 | 网址中的 `from` |
| 导航排序状态 | 浏览路径中各列及主列表采用的排序方式，随网址保留。 | 网址中的 `sorts` |
| 章节锚点 | 指向正文某一标题或元素的位置标识。 | 元素 `id`、`#标题ID`、`anchor` |
| 共享导航片段 | 构建时生成、由浏览器加载并填入面包屑列的 HTML 内容。 | `/site/navigation/*.txt` |

描述内容组织和浏览方式时使用“分类”；指定某个内容节点及其配置时使用“栏目”。例如：“按用途分类，将文章引用到工具栏目。”

内容组织见[目录与引用](/zh/p/directories/)，列表配置见[列表与产品声明](/zh/p/collection-lists/)，路径状态见[导航状态](/zh/p/navigation-state/)。

## 配置与外观

| 术语 | 含义 | 对应标识 |
| --- | --- | --- |
| 站点层 | 项目中维护网站内容、配置、品牌资源和界面字典的部分。 | 根目录的 `content/`、`hugo.toml`、`assets/site/`、`assets/i18n/` |
| Banyan 主题 | 提供页面模板、脚本和样式的 Hugo Module，开发时简称 Module。 | `module/`、`github.com/SwawHQ/banyan/module` |
| 外观模式 | 用户选择的跟随系统、浅色或深色显示方式。 | `auto`、`light`、`dark` |
| 页面布局 | 决定页面内容如何呈现的模板，例如文章、目录列表或图片墙。 | `layout` |
| 页面元数据 | 页面文件头部声明的标题、布局及自定义配置。 | front matter、自定义字段 `params` |
| 页面配置继承 | 在上级页面声明默认配置，供指定类型的后代页面使用。 | `cascade`、`cascade.params` |
| 页面区域开关 | 选择页面装配的面包屑及文章辅助内容，同时控制对应的 SEO 数据。 | `params.slots` 中的 `breadcrumb`、`meta` |
| 首页艺术包 | 集中维护首页正文、模板、样式和脚本的页面包。 | `home-art`、`content/_res/home-art/` |

站点配置和外观设置见[站点配置](/zh/p/site-configuration/)。

## 结构化数据

| 术语 | 含义 | 对应标识 |
| --- | --- | --- |
| JSON-LD | 用 JSON 表达关联数据的格式；Banyan 用它在页面 HTML 中提供机器可读的结构化数据。 | `script[type="application/ld+json"]` |
| Schema.org 类型 | 描述网站、文章等对象的共享词汇；JSON-LD 中的 `@type` 指定对象类型。 | `https://schema.org`、`@type` |
| 站点结构化数据 | 描述网站名称和网址，供机器识别站点。 | `WebSite` |
| 文章结构化数据 | 描述文章标题、日期等信息，供机器识别文章。 | `BlogPosting` |
| 面包屑结构化数据 | 将页面的结构面包屑输出为有序路径，供机器识别页面层级。 | `BreadcrumbList` |
| 列表结构化数据 | 描述集合条目的名称、网址和顺序，供机器识别列表内容。 | `ItemList` |

JSON-LD 是表达格式，Schema.org 提供类型和字段，页面模板填入实际数据。这些数据嵌入 HTML，页面上的导航和文章元信息由各自的界面组件呈现。

## 构建与交付

| 术语 | 含义 | 对应标识 |
| --- | --- | --- |
| 站点交付配置 | 声明部署平台、HTTP 响应头、SW 缓存及页面预取规则的配置。 | `assets/site/delivery.toml` |
| 页面预取 | 在用户打开目标页面前，按规则提前获取页面，缩短后续访问等待。 | `prefetch` |
| 页面预渲染 | 在预取基础上提前加载资源并渲染目标页面，由浏览器的原生规则执行。 | `prefetch.prerender`、Speculation Rules |
| 本站 Service Worker（SW） | 在浏览器后台处理本站受管请求、缓存和离线回退的程序。 | `sw.js` |
| 站点构建版本 | 标识站点构建产物的版本，默认按构建时间生成，也可显式指定；用于页面版本显示和 SW 缓存切换。 | `params.build.version`、`sw-version.json` |
| SW 版本缓存桶 | SW 按站点构建版本保存资源的缓存桶，版本切换后清理旧桶。 | `sw.bucket = "versioned"` |
| 指纹资源 | 发布网址含内容哈希的资源，内容变化时网址随之变化。 | `fingerprint`、内容哈希文件名 |
| SW 指纹缓存桶 | SW 按指纹网址保存资源的缓存桶，供不同构建复用相同内容。 | `sw.bucket = "fingerprinted"` |

配置和运行方式见[交付与缓存](/zh/p/delivery/)。
