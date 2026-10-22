---
title: UI 命名与职责
url: p/ui-naming/
description: 约定页面列、列表、条目、样式类与行为标记的命名。
---

名称按当前职责组织，不再描述已经退役的主菜单、顶部面包屑和下拉布局。

| 实体 | 名称与位置 |
| --- | --- |
| 第一列根入口 | `browse/root-navigation.js`、`feature-browse/navigation/root/model.html` 与 `root/render.html`；由真实页面的 `root_nav` 声明产生 |
| 可见路径列 | `browse/path-render.js`、`path-navigation.css`；语义导航 `nav.path-navigation[data-slot="breadcrumb"]`、单列 `.path-column` |
| 集合页面 | `layouts/page-collection.html`、`feature-browse/collection/render-page.html`；列表内容由 `feature-browse/collection/render.html` 渲染 |
| 公共列表与条目 | `system-ui/list/render.html` 与 `item.html` 装配完整列表和条目；`item.css` 负责控件和状态，`list-layout.css` 负责列表与固定字段宽度 |
| 文档元信息与章节目录 | `document-aside.css`；负责 `.document-meta`、`.document-toc` 和辅助列内的列表条目适配，不属于正文组件 |
| 正文右侧辅助列 | `page-shell.css` 控制 `.document-aside` 的尺寸与独立纵向滚动，`document-aside.css` 控制列内内容 |
| 正文中的有序／无序列表 | `prose-lists.css`；只作用于正文 `ul/ol/li` |
| 首页 | `layouts/page-home.html`、`entry-page-home/model.html`、`page-home.css`；交互入口为 `js/pages/home.js`，风向袋为 `assets/page-home/windsock.svg` |
| 区域开关 | `slot_flags`、`slotFlags`；值是布尔值，不再是 fragment 来源 |
| 浏览来源与排序状态 | `browse/navigation-state.js`、`browse/navigation-state.contract.js` |
| 语言和外观偏好 | `preferences/language-page.js` 仅用于选择页；`preferences/language-return.js` 与 `preferences/theme.js` 负责跨页面行为；静态选项和返回链接在模板输出 |
| PWA 状态与检查 | `updates/page.js` 查询本页 registration 并显示状态；模板为 `feature-updates/panel.html`、`feature-updates/labels.html` |

## 内容声明

集合页统一声明 `layout: page-collection`。例如更新目录只显示名称：

```yaml
layout: page-collection
list: name
```

`layout` 选择页面模板，`list` 选择列表展示。普通目录收纳真实文章，`_map.toml` 增加其他文章的引用；`aggregate` 指向需要汇总的目录。根站点与模块内容使用同一命名。

## 路径数据与显示

服务端的 `feature-browse/navigation/path/` 与浏览器端的 `browse/path-entry.js`、`browse/path-render.js`、`browse/breadcrumb-*.js` 共同处理结构路径、浏览来源及恢复。`system-metadata/seo/breadcrumb.html` 输出 SEO 的 BreadcrumbList；`slots.breadcrumb` 和网址 `from / sort / sorts` 保持既有约定。

可见路径列通过 `renderPathColumns()` 装配，通过 `renderPathColumn()` 重绘单列，列模型统一使用 `{source, items}`。结构路径项与列条目分开保存。浏览器来源列的 `selected` 是纯路径项，行的选中状态使用 `current`；输入参数 `selected_href` 仍表示用哪个地址寻找当前行。条目模块接收已解码的 payload，读取与缓存边界见 [导航状态](/zh/p/navigation-state/#内嵌-collection-payload)。

首页、普通页面分别使用 `model-home`、`model-page` 生成结构路径；`model.html` 保留按页面类型选择模型的显式分支，不再使用没有对应手动模式的 `-auto` 后缀。

## 公共页面列

`.page-column` 表示独立纵向滚动的页面列。四种容器保留各自的角色类：

| 角色 | 滚动容器 |
| --- | --- |
| 第一列根入口 | `.page-rail.page-column` |
| 每个路径列 | `.path-column.page-column` |
| 主内容列 | `.page-content.page-column` |
| 文档辅助列 | `.document-aside.page-column` |

`.page` 是视口宽度容器，为 `100cqi` 提供尺寸基准。`.page-shell` 是唯一负责屏幕横向列排列的 Grid，按 DOM 顺序排列根入口、路径列、主内容和辅助列。路径导航使用 `display: contents`，其 `.path-column` 直接参与 shell Grid。列容器的 DOM 如下：

```text
.page
└─ .page-shell
   ├─ .page-rail.page-column
   ├─ nav.slot.path-navigation[data-slot="breadcrumb"]
   │  └─ .path-column.page-column（每个路径列）
   ├─ .page-content.page-column
   │  └─ #main.slot-main
   └─ .document-aside.page-column
```

`page-shell.css` 统一控制屏幕排列、列尺寸、纵向滚动、纵向边界行为和打印分组。`.column-panel` 限制窄面板宽度，普通文章和窄面板标题使用 `.column-heading`，两者也由 `page-shell.css` 控制。`#main.slot-main` 位于主内容滚动容器内，仍是正文定位和页面装配入口。

`--main-column-inline` 控制主内容宽度，默认取 `88ch` 与视口可用宽度的较小值。`--navigation-column-inline` 统一控制第一列、路径列与列表名称列，默认 `15rem`。`--document-aside-inline` 独立控制辅助列，默认 `min(30rem, 100cqi)`。`--page-shell-gap-inline` 统一控制画幅列间距。辅助列与导航列从同一顶部开始。各屏幕宽度使用同一套画幅，不增加 rail／path 转发变量。

元信息或章节实际非空时才输出辅助列，DOM 顺序与视觉顺序一致。正文内的表格和代码保留局部横向滚动，不使用 `.page-column`。路径待绘制时，透明状态直接作用于真实 `.path-column`，保留列盒的宽度。

打印时 shell 使用两列：根入口在左侧跨行；路径导航在右侧横排各路径列；主内容和辅助列在右侧按顺序纵排。所有页面列展开，不保留屏幕内的纵向滚动。

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
| `page-home.html` 与 `entry-page-home/` | `page-home.css`：首页场景 |
| `feature-updates/panel.html`、`404.html` | `updates-panel.css`、`not-found.css`：各自的小型呈现规则 |

`assets/css/page.css` 按“配色 → 基础与画幅 → 共享列表 → 功能适配”声明 `@import`，`system-ui/page-styles.html` 用 `css.Build` 构建。选中的配色通过 `importContext` 注入；正文入口 `assets/css/prose.css` 同样管理七个 `prose-*` 的导入顺序。共享文件定义组件默认外观，路径列和辅助列的特有规则放在各自文件。公共列表使用 `list-*` 与 `item-*`，供第一列、路径列、主列表、语言、外观和章节目录复用。`collection` 保留为集合模型、配置、来源与排序的领域名称。

源码文件表达维护职责，发布文件表达缓存边界。`baseof.html` 通过上述入口装配公共 `page.css`；`feature-document/styles.html` 将七个 `prose-*` 源码合并成一个 `prose.css`，由确实输出 `.prose` 的页面加载；`updates-panel.css` 与 `not-found.css` 虽保留独立源码归属，也进入 `page.css`。首页另发 `page-home.css` 和三种语言各自的场景样式，因此完整生产构建共有 6 个 CSS 资源。

## 首页命名与资源

首页内部统一使用 `page-home`：根节点 `.page-home`、子元素 `.page-home__*`、页面变量与动画 `--page-home-*`／`page-home-*`、信号控件 `data-page-home-signal` 与选中标记 `data-page-home-signal-selected`。模板的 `pageHomeModel` 返回 `signals` 与 `sceneCSS`，后者发布为 `page-home-scene.<page-key>.css`；单个信号的局部参数为 `--signal-lift`、`--signal-duration`、`--signal-delay`。

JS 的 `pageHomes` 表示首页根节点，`scenePauseStates` 表示场景暂停原因，`selectedSignalControl` 表示选中的信号控件；操作使用 `setScenePaused`、`initSignalButtons`、`setSignalSelected`、`clearSelectedSignal` 等具名函数。`pages/home.js` 的目录已经表达页面归属，不重复添加 `page-` 前缀。

风向袋是首页私有的 SVG 资源，由 `resources.Get "page-home/windsock.svg"` 直接读取并内联；无需为它维护三个语言的隐藏内容页面。站点如需定制，可在根目录的 `assets/page-home/windsock.svg` 覆盖同名主题资源。

内容字段 `brand_line`、`home_signals` 与 `home_signal_*`／`home_wind_field_start_offset_rem` 保留既有语义；Hugo 原生的 home Kind、`home.llms.txt`、导航的 `model-home.html` 也不属于这次内部命名迁移。

## 更新模块

`feature-updates/labels.html` 返回 Powered by 页提供的文案，`feature-updates/panel.html` 负责 HTML，`assets/css/updates-panel.css` 负责呈现。`assets/js/updates/page.js` 读取本页文案、查询原生 registration，并绑定状态与手动检查按钮。该小型 CSS 源码仍由公共 `page.css` 装配；页面脚本只由 `page-powered-by.html` 加载。普通页面的 `pwa/manager-entry.js.tmpl` 只在加载后注册 SW；预渲染页面等到激活后再注册。页面不创建全局更新运行时，不补当前页缓存，不拦截链接，也不主动激活程序。程序更新和激活由浏览器管理；手动检查不激活或重载。未启用 SW 时，面板显示不可用。

## 样式类与行为标记

第一列、路径列、主列表、选择列表和更新操作在 SSR 中共用 `system-ui/list/render.html` 与 `item.html`。前者输出 `.item-list` 和表头外层；后者输出完整的 `.list-item`，包含名称控件及功能模板已生成的字段 HTML。`item-link.html` 与 `item-button.html` 输出原生控件，均调用 `item-content.html` 输出图标和文字。浏览器动态路径列继续按同一 DOM 协议绘制。

每条使用独立 Grid，表头使用相同的字段宽度和间距，分隔线是表头自身的下边框。父路径列只显示名称，当前集合列按列表类型显示其他字段。`path/column-header.html` 生成名称字段，公共列表为它输出 `.list-header--path` 外层；`.item-list--path-column` 保留父列表头的名称与排序控件布局。选择列表的标题仍使用 `h1.list-header`。

条目字段使用 `.item-field`，名称、日期等用 `--name`、`--date` 等修饰。链接和按钮共用 `.item-control`，图标与标题使用 `.item-icon`、`.item-title`，数量单位使用 `.item-count-unit`。名称控件自身就是名称字段，不再套一层名称容器。当前选中使用 `.is-current`，控件外观与状态变量使用 `--item-*`，颜色值由所选配色文件提供。

`.list-header` 只表示列表头，排序箭头使用 `.list-sort-indicator`。普通文章和窄面板标题见 [公共页面列](#公共页面列)。路径列头内部使用 `.path-column-label`、`.path-column-sort`、`.path-column-separator` 和 `.path-sort-label`。

字段宽度由 CSS 决定，不随内容自动扩展。名称使用 `--navigation-column-inline`；日期、数量／大小、路径、价格和价值说明分别使用 `--item-date-inline`、`--item-count-inline`、`--item-path-inline`、`--item-price-inline` 和 `--item-value-inline`，默认值为 7、5、12、6 和 18rem。`--item-field-gap` 控制字段间距，默认 `0.6rem`。`--list-field-tracks` 定义字段轨道，`--list-inline-size` 定义列表总宽度。站点可在公共样式中覆盖这些变量。长值在字段内截断，完整值保留在提示中。

排序读取 `data-list-item` 上的 `data-sort-*`，直接移动完整条目；表头使用 `data-list-header`，不参与内容排序。字段位置使用 `data-item-field="name|date|count|size|path|price|value"`，进入条目使用 `data-list-entry`，排序箭头保留 `data-sort-indicator`。这些标记表达行为，样式类表达呈现；SSR 和动态路径列一起输出它们。`feature-browse/collection/sort/header.html` 配置并生成表头字段，单个排序字段由 `sort/field.html` 输出。

正文元信息统一为 `.document-meta__row`、`__label`、`__separator`，跳转正文链接为 `.skip-link`。

`base.css` 仅负责元素默认值、焦点、跳转正文和全站过渡。共享不等于基础：图标、画幅和列表仍用自身职责命名，不因进入 `page.css` 而机械增加 `base-` 前缀。

新增名称前先确认职责；不因为位置移动而重命名 Hugo 原生字段、公开网址协议或已有准确名称，也不保留无删除条件的旧名称转接层。
