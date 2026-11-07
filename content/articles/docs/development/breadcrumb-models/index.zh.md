---
title: 路径导航模型
date: 2026-11-06
lastmod: 2026-11-07
url: p/breadcrumb-models/
description: 说明根导航、来源列和文章进入路径的构建及呈现模型。
---

## 第一列与进入路径

第一列是当前语言站点的真实根页面列表。`feature-browse/navigation/root/pages.html` 将 Home 与 `Home.Pages` 取并集，再按页面 `weight` 排序，保留完整结构供归属与来源模型使用。

`feature-browse/navigation/root/model.html` 从结构根页面生成可见入口，负责已发布 HTML 页面过滤、名称、地址、图标和默认选中状态。名称取 `LinkTitle` / `Title`，地址取 `RelPermalink`；`build.list: local` 的系统页面也可以参与。`root/render.html` 只装配 `nav` 与公共列表。

首页自身作为普通根入口，名称与图标由站点首页声明。页面不声明主菜单归属，也没有独立的菜单项目白名单。
新增入口时，创建真实的根页面并设置名称和权重；新增某个入口的子项时，把它放在相应内容目录中。

## 选中规则

`feature-browse/navigation/root/selected.html` 从当前页面及真实内容祖先中找根入口，提供静态 HTML 的默认选中项。
公开 URL 可以与内容路径不同，因此不能根据 URL 前缀猜所属入口。文章默认使用真实目录祖先，例如 `content/articles/category1/example/index.zh.md` 的根入口为 `/articles/`，发布网址为 `/zh/p/example-product/`。`content/powered-by/` 是独立根页面，选中自己的入口，无子页路径列。

有效的 `from` 指向当前页面已发布的来源集合。运行时根据列索引和有效来源路径调整第一列选中项，完整入口列表始终保留。
在 Banyan 演示中，从“文章 - 分类”进入同一篇文章就选中“文章 - 分类”，从“产品 - 全部”进入就选中“产品 - 全部”。不存在或不属于当前文章的来源不参与选中，继续使用内容祖先。
系统页面选中自己的根入口，使用普通页面网址；返回按钮使用浏览器历史记录，不另存原阅读地址。语言选择后的返回行为见 [导航状态协议](/zh/p/navigation-state/#系统页面与返回)。首页作为显式根入口时选中自己；没有根入口祖先的内部页不强制选中一项。

`_map.toml` 将原文加入引用栏目的成员和来源模型，不创建新 Page，也不修改原文的 Parent。
从该栏目点击正文时，链接携带栏目的 `#from=`；刷新、返回和排序继续使用相同来源。
文章元信息同时显示真实目录和额外引用栏目；canonical、SEO 路径和正文网址仍使用原文的真实结构。

## 路径模型

`feature-browse/navigation/path/model.html` 根据普通页面或首页的真实结构生成构建期模型：

- `root_item`：真实结构中的根入口。
- `schema_items`：结构化数据中的页面路径。
- `nodes`：根入口之后的 `{item, owner}` 节点。

`item` 表示路径项，owner 是提供兄弟条目的 Hugo Page。例如示例文章的目标是 `/p/example-product/`，兄弟条目来自 `/articles/category1/`。Hugo Page 不进入浏览器。

`path/columns.html` 根据 owner 从 `columns_by_href` 取得列模型；未注册排序集合的 owner 使用 `source/fallback-model.html`。列模型包含 source、rows 和共享片段地址 `payloadUrl`。source 使用 `logicalPath`、`href`、`label`、`sortVariant`、`defaultSort`。

`source/page-model.html` 和 `source/models.html` 复用集合的配置、成员及行模型；`source/publish.html` 通过 `source/fragment.html` 输出带指纹的 `.txt` HTML。默认来源和有效引用来源共用这些资源，不在每篇正文中复制行数据。

`source/pack.html` 将当前页面需要的列投影成 `data-navigation`：语言首页、资源目录、逻辑路径到哈希的映射、默认尾列和错误说明。读取边界见 [导航状态](/zh/p/navigation-state/#内嵌-collection-payload)，命名见 [UI 命名与职责](/zh/p/ui-naming/)。

浏览器的 `entry-source.js` 选择路径；`breadcrumb-source.js` 读取和校验片段；`path-render.js` 克隆 HTML 并调整链接、排序和选中态。`preparePathColumns()` 保留滚动容器，`renderPathColumn()` 填充单列。第一列只渲染一次，不包含在共享片段中。

## 布局与维护边界

第一列、主列表和共享导航片段复用公共列表与完整条目组件。`source/fragment.html` 输出路径列头及行，浏览器克隆这些节点。DOM 与样式归属见 [UI 命名与职责](/zh/p/ui-naming/#样式类与行为标记)。版权、备案等信息使用普通根入口。
`params.slots` 中的 `breadcrumb` 控制是否显示路径栏，不存储浏览状态。

移动与桌面共用横向列布局。初始页面的 `nav.path-navigation[data-slot="breadcrumb"]` 只保留容器；骨架脚本在 `#main` 之前按当前索引预留路径列，加载后在原列中填充共享 HTML。根导航、栏目主列表和正文保留原生 HTML。

片段中的文章链接在来源不同于文章默认归属时携带 `from`，与排序后的链接规则一致。例如 `/articles/docs/guide/` 页面上的 docs 列，其文章链接使用 `#from=articles/docs`。分类和聚合列表链接使用集合自身地址，不生成冗余的 `from`；在列表页排序也沿用自身完整路径。

排序复用已加载的行，保留列头、图标、选中节点和列内滚动位置。主列表和路径列统一更新 `sorts` 中各自对应的一项，保留文章的 `from`、锚点和其他参数；生成链接时省略默认值和尾部默认项，中间默认项用 `_` 保留位置。子栏目行提供目标排序类型与默认值，页面加载不自动改写排序网址。排序不增加历史记录。主列表排序后同步刷新路径列链接，使新标签打开也保留最新排序。

来源变化由 `initializeBreadcrumb()` 重新选择列，加载所需资源后填充已有容器；按需增减列，不整体替换 nav。加载失败显示本地化说明。来源片段不包含当前文章时，清除无效 `from` 并恢复默认路径。

文档负责整页横向滚动，各页面列独立纵向滚动。列角色、尺寸与滚动容器见 [公共页面列](/zh/p/ui-naming/#公共页面列)。辅助列随画幅横向移动，正文滚动时保持原位；无需 fixed、sticky 或滚动同步脚本。主列表随内容列参与整页画幅，不增加内部横向滚动。

`params.slots` 中的 `meta` 统一控制文章元信息、章节目录和 BlogPosting。长分类路径在辅助列内换行。打印时元信息排在正文后，章节导航隐藏。章节 URL 的进入、刷新、返回和前进均定位到该章节，不存储章节内阅读进度。`canvas-document-aside` 验证三语言、窄屏与宽屏、独立滚动、列顶对齐、无空列和打印行为。

`browse/canvas-position.js` 实现画幅状态，`inline/canvas-position.js` 负责首帧装配。它们不再主动把新页面的主列移入视野。沿列表在同标签页打开页面时，只向下一文档传递来源、目标与横向视觉坐标；目标页读取后清除记录，来源与目标匹配的新访问才使用，已有列保持位置，新列向右扩展。内联入口位于头部样式之后，在解析到 `#main` 时通过临时 `scroll-margin` 和一次原生 `scrollIntoView` 还原坐标，随后清除临时样式。浏览器自行处理桌面文档横向滚动与手机视觉视口平移，不另建横向滚动容器或设备模式。主列宽度与前置骨架须提前确定；已有滚动位置、锚点或加载期间的输入优先。直接访问从画幅起点开始，历史返回、前进和刷新的横向位置使用原生恢复，同步初始化与列内局部排序重绘不重置画幅。

各列的纵向滚动和历史位置恢复交给浏览器，保留默认的 `history.scrollRestoration = "auto"`，不增加位置存储或自建恢复逻辑。接受不同浏览器、缓存和加载场景下的恢复差异。

普通点击与当前完整 URL 相同、且不带锚点的集合或路径链接时，取消重复导航，保持画幅与正文阅读位置；修饰键、新标签页和锚点链接仍保留原生行为。`canvas-source-navigation` 回归覆盖浅层与深层来源的列容器连续性和重复点击。需要 WebKit 时，选择 Skill 的 `check/browser/canvas/open.webkit`、`check/browser/canvas/first-paint.webkit` 或 `check/browser/nav/anchors.webkit`。产物目录作为命令参数，其他参数见各命令 `--help`。

`browse/auto-scrollbar.js` 仅控制显隐：桌面正文列滚动时显示原生滚动条，停止 500ms 后使其透明；鼠标悬停在原生滚动条占用的范围内时保持显示，悬停正文不触发。正文容器在正文宽度之外预留一份 `--page-shell-gap-inline`，辅助列不再追加外部间距；滚动条使用这份空间，短内容及覆盖式滚动条也保留默认 15px。`scrollbar-gutter: stable` 稳定原生占位；系统滚动条更宽时，正文适应可用宽度，间距允许随之加宽。主列表使用统一字段布局，打印时移除预留空间。触屏与强制颜色模式保持系统默认颜色，禁用 JS 时仍可正常原生滚动。

整页以 `overscroll-behavior: none` 限制边界回弹和下拉刷新；各列只设置 `overscroll-behavior-y: none`，阻止纵向回弹和滚动传递，保留横向手势传给文档。不要在整页设置 `touch-action: pan-x`，否则子列的纵向触控也会被禁止。Safari 浏览器层的下拉刷新仍需真机验证，不通过全局触摸拦截或自定义滚动模拟补偿。

修改路径排序协议参见 [导航状态协议](/zh/p/navigation-state/)。列表与产品声明见 [列表与产品声明](/zh/p/collection-lists/)。主题状态由外观选择页切换，语义颜色由 `params.appearance.palette` 指定的文件提供；自定义配色使用站点维护的完整角色文件，详见 [配色约定](/zh/p/site-configuration/#palette)。
