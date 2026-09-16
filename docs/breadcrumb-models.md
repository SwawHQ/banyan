# Banyan Breadcrumb Model

## 第一列与进入路径

第一列是当前语言站点的真实根页面列表，由 `feature-browse/navigation/root/pages.html` 构建：
`Home.Pages` 与直接属于 Home 的 taxonomy 根页面取并集，再按页面 `weight` 排序。
名称取 `LinkTitle` / `Title`，地址取 `RelPermalink`。只有显式声明 `root_nav: true` 的根页面才显示，`build.list: local` 的系统页面也可以参与。

首页自身作为普通根入口，使用版权文字与字符图标。页面不声明主菜单归属，也没有独立的菜单项目白名单。
新增入口时，创建真实的根页面并设置 `root_nav: true`、名称和权重；新增某个入口的子项时，把它放在相应内容目录中。

## 选中规则

`feature-browse/navigation/root/selected.html` 从当前页面及真实内容祖先中找根入口，提供静态 HTML 的默认选中项。
公开 URL 可以与内容路径不同，因此不能根据 URL 前缀猜所属入口。例如 `content/d/products/xvenv/` 发布在 `/p/xvenv/`，仍属于真实目录；目录隐藏时第一列不选中。`content/powered-by/` 是独立根页面，选中自己的入口，无子页路径列。

有效的 `from` 指向当前页面已发布的来源集合。预览与运行时根据该来源的 `root_item` 调整第一列选中项，完整入口列表始终保留。
从“标签”进入同一篇文章就选中“标签”，从“产品－全部”进入就选中“产品－全部”。不存在或不属于当前文章的来源不参与选中，继续使用内容祖先。
系统页面选中自己的根入口，使用普通页面网址；返回按钮使用浏览器历史记录，不另存原阅读地址。语言选择后的返回行为见 [navigation-state.md](navigation-state.md#系统页面与返回)。首页作为显式根入口时选中自己；没有根入口祖先的内部页不强制选中一项。

## 路径模型

`feature-browse/navigation/path/model.html` 根据普通页面、首页或 taxonomy 的真实结构构建模型：

- `root_item`：第一列应选中的根页面。
- `tail_items`：根页面之后的路径项目。
- `levels`：各路径项目及其所属集合。
- `schema_items`：结构化数据中的页面路径。

项目自身的 `href` 与提供兄弟条目的 `collection_href` 含义不同。例如“WSL”项目指向 `/d/wsl/`，其兄弟列表来自 `/d/`。`collection_label` 取该所属页面的名称，用于没有排序 provider 的静态列头。
每个路径项目的 `column_items` 保存该列要显示的兄弟条目；没有兄弟条目时，渲染器只显示项目自身。它是普通列数据，不含展开、隐藏或下拉状态。

可见路径列由 `assets/js/browse/path-render.js`／`path-navigation.css` 实现，使用 `renderPathColumns()` 与 `renderPathColumn()`；结构模型和 SEO BreadcrumbList 仍属于 breadcrumb。行选中状态统一使用 `current`，不再接受 `highlighted` 或 `selected` 别名。完整命名约定见 [UI 命名与职责](ui-naming.md)。

`feature-browse/navigation/path/section-items.html` 和 `feature-browse/navigation/path/taxonomy-items.html` 分别查找真实父目录与分类父级，通过 `feature-browse/navigation/path/items-from-rows.html` 把条目转换成统一的 `text`、`href`、`current`、`title`、`kind`、`icon` 字段。调用方已经提供统一行结构，不再另传字段名称。

`feature-browse/navigation/source/page-model.html` 将这些层级映射到集合 provider 与当前页面内嵌的 source model。所有列表页统一使用 collection 来源，排序字段由 `list` 声明决定。主列表与路径列 source 共用 `feature-browse/collection/rows.html`。浏览器 source 携带当前集合和祖先集合所需的紧凑 `collection_items`，不再发布或请求 `_items.json`。

首页、普通页面和 taxonomy 的模型生成器负责不同的路径来源，最终共用一个列渲染器。`feature-browse/navigation/path/model.html` 直接按 Hugo 页面种类调用相应生成器；模型不返回 `variant` 或 `strategy` 标签，也没有额外的字符串分发层。

第一列只渲染一次，来源模型不携带完整根菜单，也不根据“第一列已覆盖”删除路径集合。分类根的子项可作为第二列出现，分类数量由内容决定。

## 布局与维护边界

第一列、路径列和内容列表共用 `system-ui/list/link-cell.html` / `system-ui/list/item-content.html`、选中状态与导航列宽。版权、备案等信息使用普通根入口，已无独立页脚。
`slots.breadcrumb` 仅控制路径栏是否显示；它不控制全站入口初始化，也不存放进入路径状态。

各宽度采用同一横向列结构：每个尾部路径项目是一列普通列表，直接展示兄弟项目；没有兄弟列表时仍显示该项目的一行链接。SSR 与客户端重绘使用相同的列头、图标与选中规则，不再存在下拉菜单触发器、隐藏面板或宽度模式。

路径列中的文章链接在 SSR 时就携带该列所属集合的 `from`，与客户端重绘一致。例如在 `/tags/tooling/devtools/` 页面，`tooling` 列里的文章链接使用 `?from=tags/tooling`。不能等排序或来源参数触发重绘后再补齐，否则直接访问、慢脚本和刷新后的链接会不同；集合行仍使用集合自身地址。

排序复用已有 HTML：点击列头或打开仅带排序参数的页面时，用内嵌集合数据确定顺序，移动已有行，不替换列头、图标和选中节点。只更新链接的 `sort` / `sorts`，保留 `from`、锚点和其他参数；没有顺序变化的后续列只更新排序链接。排序时保持列内滚动位置，列头节点不变，因此不需要重新寻找并恢复焦点。

来源路径需要显示另一组列时，在解析正文前预留列容器，运行时只填充列内内容，保留 `.path-navigation` 与各 `.path-column` 节点。不能整体替换来源列：WebKit 会在移除这些滚动容器时重置已恢复的横向位置，即使新旧列的数量和宽度完全相同。运行时同步各列的集合地址，并移除占位导航的 `aria-hidden`，使填充后的链接正常参与辅助技术导航。

文档只负责整页横向滚动；入口和路径列固定为 `15rem`，右侧辅助列为 `min(30rem, 100cqi)`，正文取视口可用宽度与 `88ch` 的较小值。第一列、每个路径列、正文和辅助列分别纵向滚动；`.page-content` 只承载正文，元信息位于其兄弟节点 `.document-aside`。辅助列随画布横向移动，正文滚动时保持原位；无需 fixed、sticky 或滚动同步脚本。集合表格按内容宽度扩展整页画幅，不增加内部横向滚动；正文中的表格与代码保留局部横向滚动。DOM 顺序与视觉顺序一致。

`.page-stage` 按 DOM 顺序排列路径、正文和辅助列，不再根据路径存在与否指定不同的列号。元信息或章节实际非空时才输出辅助列；`slots.meta` 控制元信息，`page-article` 布局独立装配章节。辅助列从列顶开始，与第一列和路径列共用页面顶部留白；正文标题的上下间距由正文样式独立控制，长分类路径在列内换行。打印时各列展开，元信息排在正文后，章节导航隐藏。章节 URL 的进入、刷新、返回和前进均定位到该章节，不存储章节内阅读进度；实现及取舍见 [元信息与章节试验](document-aside-study.md)。`canvas-document-aside` 验证三语言、窄屏与宽屏、独立滚动、列顶对齐、无空列和打印行为。

`browse/canvas-position.js` 实现画幅状态，`inline/canvas-position.js` 负责首帧装配。它们不再主动把新页面的主列移入视野。沿列表在同标签页打开页面时，只向下一文档传递来源、目标与横向视觉坐标；目标页读取后清除记录，来源与目标匹配的新访问才使用，已有列保持位置，新列向右扩展。内联入口位于头部样式之后，在解析到 `#main` 时通过临时 `scroll-margin` 和一次原生 `scrollIntoView` 还原坐标，随后清除临时样式。浏览器自行处理桌面文档横向滚动与手机视觉视口平移，不另建横向滚动容器或设备模式。主列宽度与前置骨架须提前确定；已有滚动位置、锚点或加载期间的输入优先。直接访问从画幅起点开始，历史返回、前进和刷新的横向位置使用原生恢复，同步初始化与列内局部排序重绘不重置画幅。

各列的纵向滚动和历史位置恢复交给浏览器，保留默认的 `history.scrollRestoration = "auto"`，不增加位置存储或自建恢复逻辑。接受不同浏览器、缓存和加载场景下的恢复差异。

普通点击与当前完整 URL 相同、且不带锚点的集合或路径链接时，取消重复导航，保持画幅与正文阅读位置；修饰键、新标签页和锚点链接仍保留原生行为。`canvas-source-navigation` 回归覆盖浅层与深层来源的列容器连续性和重复点击。除默认 Chromium 回归外，可运行 `node themes/banyan/scripts/browser-regression/browser-webkit.mjs` 验证 WebKit 的来源导航、首帧、历史和锚点行为；构建目录沿用 `BANYAN_BROWSER_BUILD_DIR`。

`browse/auto-scrollbar.js` 仅控制显隐：桌面正文列滚动时显示原生滚动条，停止 500ms 后使其透明；鼠标悬停在原生滚动条占用的范围内时保持显示，悬停正文不触发。正文容器在正文宽度之外预留一份 `--page-shell-gap-inline`，辅助列不再追加外部间距；滚动条使用这份空间，短内容及覆盖式滚动条也保留默认 15px。`scrollbar-gutter: stable` 稳定原生占位；系统滚动条更宽时，正文适应可用宽度，间距允许随之加宽。集合表格继续按内容撑宽，打印移除预留空间。触屏与强制颜色模式保持系统默认颜色，禁用 JS 时仍可正常原生滚动。

整页以 `overscroll-behavior: none` 限制边界回弹和下拉刷新；各列只设置 `overscroll-behavior-y: none`，阻止纵向回弹和滚动传递，保留横向手势传给文档。不要在整页设置 `touch-action: pan-x`，否则子列的纵向触控也会被禁止。Safari 浏览器层的下拉刷新仍需真机验证，不通过全局触摸拦截或自定义滚动模拟补偿。

修改路径排序协议参见 [navigation-state.md](navigation-state.md)。列表与产品声明见 [collection-lists.md](collection-lists.md)。主题状态由外观选择页切换，具体语义颜色集中在 `theme.css`；黑白灰收敛属于后续 6C。历史实施过程见 [入口展平记录](navigation-flattening-plan.md)。
