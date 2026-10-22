---
title: 路径导航模型
slug: breadcrumb-models
description: 说明根导航、来源列和文章进入路径的构建及呈现模型。
---

## 第一列与进入路径

第一列是当前语言站点的真实根页面列表。`feature-browse/navigation/root/pages.html` 将 Home、`Home.Pages` 与直接属于 Home 的 taxonomy 根页面取并集，再按页面 `weight` 排序，保留完整结构供归属与来源模型使用。

`feature-browse/navigation/root/model.html` 从结构根页面生成可见入口，负责 `root_nav: true` 过滤、名称、地址、图标和默认选中状态。名称取 `LinkTitle` / `Title`，地址取 `RelPermalink`；`build.list: local` 的系统页面也可以参与。`root/render.html` 只装配 `nav` 与公共列表。

首页自身作为普通根入口，名称与图标由站点首页声明。页面不声明主菜单归属，也没有独立的菜单项目白名单。
新增入口时，创建真实的根页面并设置 `root_nav: true`、名称和权重；新增某个入口的子项时，把它放在相应内容目录中。

## 选中规则

`feature-browse/navigation/root/selected.html` 从当前页面及真实内容祖先中找根入口，提供静态 HTML 的默认选中项。
公开 URL 可以与内容路径不同，因此不能根据 URL 前缀猜所属入口。例如 `content/d/example-tool.md` 发布在 `/p/example-tool/`，仍属于真实目录；目录隐藏时第一列不选中。`content/powered-by/` 是独立根页面，选中自己的入口，无子页路径列。

有效的 `from` 指向当前页面已发布的来源集合。运行时根据浏览器来源的 `rootItem` 调整第一列选中项，完整入口列表始终保留。
从“发现 - 分类”进入同一篇文章就选中“发现 - 分类”，从“工具 - 全部”进入就选中“工具 - 全部”。不存在或不属于当前文章的来源不参与选中，继续使用内容祖先。
系统页面选中自己的根入口，使用普通页面网址；返回按钮使用浏览器历史记录，不另存原阅读地址。语言选择后的返回行为见 [导航状态协议](/zh/docs/development/navigation-state/#系统页面与返回)。首页作为显式根入口时选中自己；没有根入口祖先的内部页不强制选中一项。

## 路径模型

`feature-browse/navigation/path/model.html` 根据普通页面、首页或 taxonomy 的真实结构构建模型。该模型只用于构建期：

- `root_item`：第一列应选中的根页面。
- `schema_items`：结构化数据中的页面路径。
- `nodes`：根页面之后的结构节点，每项为 `{item, owner}`。

`nodes[].item` 是纯路径项，`owner` 是提供兄弟条目的 Hugo Page；没有所属页面时为空。两者的地址含义不同。例如工具示例指向 `/p/example-tool/`，其兄弟列表来自 owner `/d/`。Hugo Page 不进入浏览器投影。

`feature-browse/navigation/path/columns.html` 将结构节点转换为 SSR 呈现列 `columns: [{source, items}]`。集合 owner 从 `columns_by_href` 取得 rows 和 source，再由 `items-from-rows.html` 生成名称行及 `current` 状态。该地址表复用集合的 config、rows、source 和 compact payload，主列表与路径列使用同一份集合事实。

非集合 owner 由 `fallback-column.html` 生成合法的静态列，source 只包含所属页面的 `href` 和 `label`，items 保留兄弟条目。没有兄弟条目或 owner 时，列仍显示路径项自身。

`feature-browse/navigation/source/page-model.html`、`models.html` 和 `browser-models.html` 生成当前页面需要的浏览器来源：

- `logicalPath`、`rootItem`：来源地址与第一列选中项。
- `columns: [{selected, source, payload}]`：祖先列；`selected` 是纯路径项，payload 是紧凑 row 数据。
- `currentColumn: {source, payload}`：来源集合的当前列。

有效集合列只携带 compact payload，不重复输出可见 items。非集合 owner 使用静态形式 `{selected, source: {href, label}, items}`。collection source 统一使用 `logicalPath`、`sortVariant`、`defaultSort`；所有列表页仍使用 collection provider，排序字段由 `list` 声明决定。不再发布或请求 `_items.json`。

浏览器解码来源并结合网址状态生成 `{source, items}` 呈现列，由 `assets/js/browse/path-render.js`／`path-navigation.css` 绘制。`renderPathColumns()` 装配所有列，`renderPathColumn()` 重绘单列；行选中状态使用 `current`。读取与缓存边界见 [导航状态](/zh/docs/development/navigation-state/#内嵌-collection-payload)，命名约定见 [UI 命名与职责](/zh/docs/development/ui-naming/)。

首页、普通页面和 taxonomy 的模型生成器负责不同的路径来源，最终共用一个列渲染器。`feature-browse/navigation/path/model.html` 直接按 Hugo 页面种类调用相应生成器；模型不返回 `variant` 或 `strategy` 标签，也没有额外的字符串分发层。

第一列只渲染一次，来源模型不携带完整根菜单，也不根据“第一列已覆盖”删除路径集合。分类根的子项可作为第二列出现，分类数量由内容决定。

## 布局与维护边界

第一列、路径列和内容列表在 SSR 中使用公共列表与完整条目组件。`feature-browse/navigation/path/column.html` 保留滚动容器、集合来源与 `from`，再把名称行交给 `system-ui/list/render.html`。`path/column-header.html` 只输出名称字段，公共列表输出表头外层并保留 `list-header--path`。浏览器动态路径列继续按现有 DOM 协议绘制。DOM 与样式归属见 [UI 命名与职责](/zh/docs/development/ui-naming/#样式类与行为标记)。版权、备案等信息使用普通根入口。
`slots.breadcrumb` 仅控制路径栏是否显示；它不控制全站入口初始化，也不存放进入路径状态。

移动与桌面共用 Finder 风格的横向列布局：每个尾部路径项目是一列普通列表，直接展示兄弟项目；没有兄弟列表时仍显示该项目的一行链接。SSR 与客户端重绘使用相同的列头、图标与选中规则。

路径列中的文章链接在 SSR 时就携带该列所属集合的 `from`，与客户端重绘一致。例如在 `/tags/tooling/devtools/` 页面，`tooling` 列里的文章链接使用 `#from=tags/tooling`。不能等排序或来源参数触发重绘后再补齐，否则直接访问、慢脚本和刷新后的链接会不同；集合行仍使用集合自身地址。

排序复用已有 HTML：点击列头或打开仅带排序参数的页面时，用内嵌集合数据确定顺序，移动已有行，不替换列头、图标和选中节点。只更新链接的 `sort` / `sorts`，保留 `from`、锚点和其他参数；没有顺序变化的后续列只更新排序链接。排序时保持列内滚动位置，列头节点不变，因此不需要重新寻找并恢复焦点。

`nav.path-navigation[data-slot="breadcrumb"]` 是 shell 内的语义导航，屏幕上使用 `display: contents`，路径列直接参与 shell Grid。骨架脚本在 nav 之后、`#main` 之前执行，将 SSR 导航副本保存在 `nav.defaultPath`，再只替换 nav 的子节点以预留来源列。待绘制透明状态作用于真实 `.path-column`，保留列宽。

Hydration 填充已有列容器，保留原 nav 与相同位置的 `.path-column`；列数变化时按需增减列。这样可避免 WebKit 因整体替换滚动容器而重置画幅。运行时同步各列的集合地址，并移除导航的 `aria-hidden`。

同一文档的 `from` 变化先调用 `initializeBreadcrumb()`，能生成来源列时直接填充已有容器。只有 `entryRendered` 为 `false` 时，才将 `nav.defaultPath` 的子节点恢复进原 nav，并清除 `aria-hidden`。只改变排序时继续复用已有列和表头。

文档负责整页横向滚动，各页面列独立纵向滚动。列角色、尺寸与滚动容器见 [公共页面列](/zh/docs/development/ui-naming/#公共页面列)。辅助列随画幅横向移动，正文滚动时保持原位；无需 fixed、sticky 或滚动同步脚本。主列表随内容列参与整页画幅，不增加内部横向滚动。

`slots.meta` 控制元信息，`page-article` 布局独立装配章节。长分类路径在辅助列内换行。打印时元信息排在正文后，章节导航隐藏。章节 URL 的进入、刷新、返回和前进均定位到该章节，不存储章节内阅读进度。`canvas-document-aside` 验证三语言、窄屏与宽屏、独立滚动、列顶对齐、无空列和打印行为。

`browse/canvas-position.js` 实现画幅状态，`inline/canvas-position.js` 负责首帧装配。它们不再主动把新页面的主列移入视野。沿列表在同标签页打开页面时，只向下一文档传递来源、目标与横向视觉坐标；目标页读取后清除记录，来源与目标匹配的新访问才使用，已有列保持位置，新列向右扩展。内联入口位于头部样式之后，在解析到 `#main` 时通过临时 `scroll-margin` 和一次原生 `scrollIntoView` 还原坐标，随后清除临时样式。浏览器自行处理桌面文档横向滚动与手机视觉视口平移，不另建横向滚动容器或设备模式。主列宽度与前置骨架须提前确定；已有滚动位置、锚点或加载期间的输入优先。直接访问从画幅起点开始，历史返回、前进和刷新的横向位置使用原生恢复，同步初始化与列内局部排序重绘不重置画幅。

各列的纵向滚动和历史位置恢复交给浏览器，保留默认的 `history.scrollRestoration = "auto"`，不增加位置存储或自建恢复逻辑。接受不同浏览器、缓存和加载场景下的恢复差异。

普通点击与当前完整 URL 相同、且不带锚点的集合或路径链接时，取消重复导航，保持画幅与正文阅读位置；修饰键、新标签页和锚点链接仍保留原生行为。`canvas-source-navigation` 回归覆盖浅层与深层来源的列容器连续性和重复点击。需要 WebKit 时，选择 Skill 的 `check/browser/canvas/open.webkit`、`check/browser/canvas/first-paint.webkit` 或 `check/browser/nav/anchors.webkit`。产物目录作为命令参数，其他参数见各命令 `--help`。

`browse/auto-scrollbar.js` 仅控制显隐：桌面正文列滚动时显示原生滚动条，停止 500ms 后使其透明；鼠标悬停在原生滚动条占用的范围内时保持显示，悬停正文不触发。正文容器在正文宽度之外预留一份 `--page-shell-gap-inline`，辅助列不再追加外部间距；滚动条使用这份空间，短内容及覆盖式滚动条也保留默认 15px。`scrollbar-gutter: stable` 稳定原生占位；系统滚动条更宽时，正文适应可用宽度，间距允许随之加宽。主列表使用统一字段布局，打印时移除预留空间。触屏与强制颜色模式保持系统默认颜色，禁用 JS 时仍可正常原生滚动。

整页以 `overscroll-behavior: none` 限制边界回弹和下拉刷新；各列只设置 `overscroll-behavior-y: none`，阻止纵向回弹和滚动传递，保留横向手势传给文档。不要在整页设置 `touch-action: pan-x`，否则子列的纵向触控也会被禁止。Safari 浏览器层的下拉刷新仍需真机验证，不通过全局触摸拦截或自定义滚动模拟补偿。

修改路径排序协议参见 [导航状态协议](/zh/docs/development/navigation-state/)。列表与产品声明见 [列表与产品声明](/zh/docs/guide/collection-lists/)。主题状态由外观选择页切换，语义颜色由 `params.appearance.palette` 指定的文件提供；黑白灰方案使用 `css/theme-monochrome.css`，详见 [配色约定](https://github.com/SwawHQ/banyan/blob/main/module/assets/README.md#select-a-palette)。
