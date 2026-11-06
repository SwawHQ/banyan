---
title: UI 命名与职责
date: 2026-11-06
lastmod: 2026-11-06
url: p/ui-naming/
description: 约定页面列、列表、条目、样式类与行为标记的命名。
---

名称按当前职责组织，不再描述已经退役的主菜单、顶部面包屑和下拉布局。

| 实体 | 名称与位置 |
| --- | --- |
| 第一列根入口 | `browse/root-navigation.js`、`feature-browse/navigation/root/model.html` 与 `root/render.html`；来自首页和已发布的直属子页 |
| 可见路径列 | `browse/path-render.js`、`path-navigation.css`；语义导航 `nav.path-navigation[data-slot="breadcrumb"]`、单列 `.path-column` |
| 集合页面 | `layouts/page-collection-directory-name-only.html`、`feature-browse/collection/render-page.html`；列表内容由 `feature-browse/collection/render.html` 渲染 |
| 公共列表与条目 | `system-ui/list/render.html` 与 `item.html` 装配完整列表和条目；`item.css` 负责控件和状态，`list-layout.css` 负责列表与固定字段宽度 |
| 文档元信息与章节目录 | `document-aside.css`；负责 `.document-meta`、`.document-toc` 和辅助列内的列表条目适配，不属于正文组件 |
| 正文右侧辅助列 | `page-shell.css` 控制 `.document-aside` 的尺寸与独立纵向滚动，`document-aside.css` 控制列内内容 |
| 正文中的有序／无序列表 | `prose-lists.css`；只作用于正文 `ul/ol/li` |
| 首页 | `layouts/page-home.html` 装配艺术包；站点艺术包维护正文、CSS、JS，`home-art/wind/scene` 输出风场 |
| 区域开关 | `slot_flags`、`slotFlags`；值是布尔值，不再是 fragment 来源 |
| 浏览来源与排序状态 | `browse/navigation-state.js`、`browse/navigation-state.contract.js` |
| 语言和外观偏好 | `preferences/language-page.js` 仅用于选择页；`preferences/language-return.js` 与 `preferences/theme.js` 负责跨页面行为；静态选项和返回链接在模板输出 |
| PWA 状态与检查 | `updates/page.js` 查询本页 registration 并显示状态；模板为 `_shortcodes/site-update.html`、`feature-updates/labels.html` |

## 内容声明

集合布局直接选择列表字段和行为。例如仅显示名称：

```yaml
layout: page-collection-directory-name-only
```

`page-collection-directory-name-only` 只显示名称，`page-collection-directory` 显示目录信息，`page-collection-products` 显示产品信息。普通目录收纳真实文章，`_map.toml` 增加其他文章的引用；对应 `-all` 布局用 `params.aggregate` 指向需要汇总的目录。站点内容与 Module 使用同一命名。

## 路径数据与显示

构建期的 `feature-browse/navigation/path/` 生成真实结构路径，`navigation/source/` 生成共享 HTML 片段与本页列索引。`system-metadata/seo/breadcrumb.html` 输出 BreadcrumbList；`params.slots` 中的 `breadcrumb` 与网址 `from/sort/sorts` 保持各自职责。

浏览器的 `browse/entry-source.js` 读取 `data-navigation`，`breadcrumb-source.js` 加载片段，`path-render.js` 复用滚动容器并克隆列头和条目。`preparePathColumns()` 维护列容器，`renderPathColumn()` 填充单列；`selectedPathname` 表示当前项，最终输出 `.is-current` 与 `aria-current`。读取边界见 [导航状态](/zh/p/navigation-state/#内嵌-collection-payload)。

首页和普通页面分别使用 `model-home`、`model-page` 生成结构路径；Hugo Page 只留在构建模型，不写入浏览器索引。

## 公共页面列

`.page-column` 表示独立纵向滚动的页面列。四种容器保留各自的角色类：

| 角色 | 滚动容器 |
| --- | --- |
| 第一列根入口 | `.page-rail.page-column` |
| 每个路径列 | `.path-column.page-column` |
| 主内容列 | `.page-content.page-column` |
| 文档辅助列 | `.document-aside.page-column` |

`.page` 是视口宽度容器，为 `100cqi` 提供尺寸基准。`.page-shell` 按 DOM 顺序横向排列根入口、路径列和 `.reading-group`。路径导航使用 `display: contents`，其 `.path-column` 直接参与 shell Grid。阅读组包含主内容和辅助列，最小宽度为 `100cqi`；剩余空间自然留在右侧，不依赖脚本测量。阅读组不滚动，各列继续独立纵向滚动。列容器的 DOM 如下：

```text
.page
└─ .page-shell
   ├─ .page-rail.page-column
   ├─ nav.slot.path-navigation[data-slot="breadcrumb"]
   │  └─ .path-column.page-column（每个路径列）
   └─ .reading-group
      ├─ .page-content.page-column
      │  └─ #main.slot-main
      └─ .document-aside.page-column
```

`page-shell.css` 统一控制屏幕排列、列尺寸、纵向滚动、纵向边界行为和打印分组。`.column-panel` 限制窄面板宽度，普通文章和窄面板标题使用 `.column-heading`，两者也由 `page-shell.css` 控制。`#main.slot-main` 位于主内容滚动容器内，仍是正文定位和页面装配入口。

`--main-column-inline` 控制主内容宽度，默认取 `88ch` 与视口可用宽度的较小值。`--navigation-column-inline` 统一控制第一列、路径列与列表名称列，默认 `15rem`。`--document-aside-inline` 独立控制辅助列，默认 `min(30rem, 100cqi)`。`--page-shell-gap-inline` 统一控制画幅列间距。辅助列与导航列从同一顶部开始。各屏幕宽度使用同一套画幅，不增加 rail／path 转发变量。

元信息或章节实际非空时才输出辅助列，DOM 顺序与视觉顺序一致。正文内的表格和代码保留局部横向滚动，不使用 `.page-column`。路径待绘制时，透明状态直接作用于真实 `.path-column`，保留列盒的宽度。

打印时 `.reading-group` 使用 `display: contents`，shell 使用两列：根入口在左侧跨行；路径导航在右侧横排各路径列；主内容和辅助列在右侧按顺序纵排。所有页面列展开，不保留屏幕内的纵向滚动。

## CSS 源码与发布名

`assets/css/` 保持扁平。layouts 的 `entry-*`、`feature-*`、`system-*` 表达模板调用边界；CSS 按视觉职责命名，不复制模板目录层级，也不要求一个模板对应一个样式文件。

| 模板职责 | CSS 归属 |
| --- | --- |
| `baseof.html` 与 `system-ui/page-slots.html` | `theme.css`、`base.css`、`page-shell.css`：主题、默认值、整体画幅、各列滚动、窄面板与标题 |
| `system-ui/icon/`、`system-ui/list/`、`system-ui/choice/` | `icons.css`、`item.css`、`list-layout.css`：图标、公共控件及状态、列表网格与列表头 |
| `feature-browse/collection/` | `list-layout.css`：完整条目与 directory／all／products 固定字段布局 |
| `feature-browse/navigation/path/` 与 `browse/path-render.js` | `path-navigation.css`：语义导航的 `display: contents`、列的待绘制状态、路径列头和列表适配，以及打印时的路径列横排 |
| `feature-document/aside.html`、`meta.html`、`toc.html` | `document-aside.css`：元信息、章节目录及列内条目适配；列尺寸和滚动仍由 `page-shell.css` 统一控制 |
| `feature-document/render-page.html` 与 Markdown 渲染 | 七个 `prose-*`：基础、行内、列表、引用、图片、代码、表格；所有正文页共用 |
| `page-home.html` 与 `entry-page-home/` | 艺术包选择的 CSS，以及风场短代码生成的场景 CSS |
| `_shortcodes/site-update.html`、`404.html` | `updates-panel.css`、`not-found.css`：各自的小型呈现规则 |

`assets/css/page.css` 按“配色 → 基础与画幅 → 共享列表 → 功能适配”声明 `@import`，`system-ui/page-styles.html` 用 `css.Build` 构建。选中的配色通过 `importContext` 注入；正文入口 `assets/css/prose.css` 同样管理七个 `prose-*` 的导入顺序。共享文件定义组件默认外观，路径列和辅助列的特有规则放在各自文件。公共列表使用 `list-*` 与 `item-*`，供第一列、路径列、主列表、语言、外观和章节目录复用。`collection` 保留为集合模型、配置、来源与排序的领域名称。

源码文件表达维护职责，发布文件表达缓存边界。`baseof.html` 通过上述入口装配公共 `page.css`；`feature-document/styles.html` 将七个 `prose-*` 源码合并成一个 `prose.css`，由确实输出 `.prose` 的页面加载；`updates-panel.css` 与 `not-found.css` 虽保留独立源码归属，也进入 `page.css`。首页只加载所引用艺术包声明的样式和脚本；风场短代码另生成对应语言的场景 CSS。资源数量由实际页面和艺术包决定。

## 首页命名与资源

`page-home.html` 是宿主首页，负责正文和艺术包资源。`entry-page-home/model.html` 返回 `art`、`assets` 和 `show_navigation`；`params.show_navigation` 只控制首页第一列。

风场正文位于站点 `content/_res/home-art/wind/index*.md`，调用 `home-art/wind/scene`。CSS、JS 位于同一叶子包，通过 `params.styles` 和 `params.scripts` 选择。资源带指纹外链发布，宿主通过 `data-home-art` 标识其来源。

风场内部继续使用 `.page-home`、`.page-home__*`、`--page-home-*` 和 `data-page-home-signal`。`entry-page-home/wind/model.html` 从艺术页参数生成 `signals` 和 `sceneCSS`；短代码为当前语言发布场景 CSS。`brand_line`、`home_signals`、`home_signal_*` 和 `home_wind_field_start_offset_rem` 都属于艺术页。

风向袋 SVG 内联于 `layouts/_shortcodes/home-art/wind/scene.html`。站点可覆写该模板修改形状；CSS 和交互修改留在艺术包，无需替换宿主首页。

## 更新模块

`feature-updates/labels.html` 返回当前语言的更新文案；`_shortcodes/site-update.html` 根据 `version`、`interval`、`policy`、`offline`、`status`、`content` 参数输出对应内容。状态和检查按钮使用原生 span、button；`assets/css/updates-panel.css` 保留其呈现规则，并进入公共 `page.css`。

`assets/js/updates/page.js` 绑定本页实际存在的程序与内容状态、检查按钮。公共模板按短代码加载一次更新脚本；`page-actions` 也按需加载返回及重试行为。

普通页面的 `pwa/manager-entry.js.tmpl` 在加载后注册 SW，预渲染页面等到激活后注册。检查按钮不激活 waiting 程序，也不自动刷新已打开页面。离线页使用 `page-offline`，不加载普通导航、预取或 SW 管理脚本。

## 样式类与行为标记

第一列、共享导航片段、主列表和选择列表在构建时共用 `system-ui/list/render.html` 与 `item.html`。前者输出 `.item-list` 和表头外层；后者输出完整的 `.list-item`，包含名称控件及功能模板已生成的字段 HTML。`item-link.html` 与 `item-button.html` 输出原生控件，均调用 `item-content.html` 输出图标和文字。浏览器动态路径列继续按同一 DOM 协议绘制。

每条使用独立 Grid，表头使用相同的字段宽度和间距，分隔线是表头自身的下边框。路径列只显示名称及排序控件，主集合列表按布局显示其他字段。`source/fragment.html` 输出 `.list-header--path`；`.item-list--path-column` 保留父列表头的名称与排序控件布局。选择列表的标题仍使用 `h1.list-header`。

条目字段使用 `.item-field`，名称、日期等用 `--name`、`--date` 等修饰。链接和按钮共用 `.item-control`，图标与标题使用 `.item-icon`、`.item-title`，数量单位使用 `.item-count-unit`。名称控件自身就是名称字段，不再套一层名称容器。当前选中使用 `.is-current`，控件外观与状态变量使用 `--item-*`，颜色值由所选配色文件提供。

`.list-header` 只表示列表头，排序箭头使用 `.list-sort-indicator`。普通文章和窄面板标题见 [公共页面列](#公共页面列)。路径列头内部使用 `.path-column-label`、`.path-column-sort`、`.path-column-separator` 和 `.path-sort-label`。

名称使用 `--navigation-column-inline`；其他两列使用 `--item-date-inline`、`--item-count-inline`，默认分别为 `5.6rem`、`3.8rem`。目录表显示更新时间及数量／大小，汇总表显示更新时间及大小，产品表显示版本及价格。三列表的 `--item-field-gap` 为 `0.25rem`；`--list-field-tracks` 定义轨道，`--list-inline-size` 定义总宽度。长值在字段内截断，完整值保留在提示中。

排序读取 `data-list-item` 上的 `data-sort-*`，直接移动完整条目；表头使用 `data-list-header`，不参与内容排序。字段位置使用 `data-item-field="name|date|count|size|version|price"`，进入条目使用 `data-list-entry`，排序箭头保留 `data-sort-indicator`。这些标记表达行为，样式类表达呈现；SSR 和动态路径列一起输出它们。`feature-browse/collection/sort/header.html` 配置并生成表头字段，单个排序字段由 `sort/field.html` 输出。

正文元信息统一为 `.document-meta__row`、`__label`、`__separator`，跳转正文链接为 `.skip-link`。

`base.css` 仅负责元素默认值、焦点、跳转正文和全站过渡。共享不等于基础：图标、画幅和列表仍用自身职责命名，不因进入 `page.css` 而机械增加 `base-` 前缀。

新增名称前先确认职责；不因为位置移动而重命名 Hugo 原生字段、公开网址协议或已有准确名称，也不保留无删除条件的旧名称转接层。
