---
title: 列表与产品声明
url: p/collection-lists/
description: 配置目录、引用、条目图标和产品列表。
---

页面的 `list` 只声明子项怎么展示。普通目录的成员来自实际文章和本目录 `_map.toml` 的引用。选择页的选项由对应布局提供。入口归属由真实根页面及有效 `from` 决定，不在内容 front matter 中写菜单。

第一列名称使用页面的 `linkTitle`，未声明时使用 `title`。语言、外观、我的的三语言主题页面直接使用无“系统－／系統－／System -”前缀的 `title`，入口与页内标题共用同一名称，无需重复声明 `linkTitle`。

第一列采用显式加入：只有根页面顶层声明布尔值 `root_nav: true` 才显示；未声明、`false` 或字符串 `"true"` 均不显示。首页自身也遵守该规则。此字段只对首页及其直接子页生效，不能把深层文章提升成根入口；不要放入 `cascade`。项目覆盖主题页面时，每种语言各自保留该声明。

入口名称和顺序由站点各语言页面的 `title`／`linkTitle` 与 `weight` 决定。

工具使用普通 `content/tools/` 目录，全部入口声明 `aggregate: /tools`。栏目通过 `_map.toml` 收录已有正文。`list: products` 和 `offer` 只控制产品展示，不控制文章归属。

“发现 - 分类”使用普通 `content/discover/` 目录；“发现 - 全部”汇总该目录的全部文章。
目录本身就是栏目，不需要另建一套同名分类。额外入口使用 `_map.toml`，
一份引用文件供同目录各语言共用，参见 [目录与引用](/zh/p/directories/)。

## 在哪里改列表

| 文件（每种语言分别配置） | 当前声明 | 列出的对象 |
| --- | --- | --- |
| 主题 `content/discover/_index.zh.md` | `list: directory` | 目录的直接子目录、文章 |
| 站点目录 `content/discover/docs/_index.zh.md` | `list: directory` | 该目录的子栏目、文章及引用 |
| 假设的站点目录 `content/discover/example-tools/_index.zh.md` | 未声明，继承 `/discover/` | 该目录的直接子项及引用 |
| 主题 `content/tools/_index.zh.md` | `list: directory` | 普通工具子目录、文章及引用 |
| 工具目录根的 `cascade`，目标 `kind: section` | `list: products` | 每个目录的直接文章及引用 |
| 主题 `content/all/index.zh.md` | `list: all`、`aggregate: /discover` | `/discover/` 下全部内容，包含子栏目引用 |
| 主题 `content/all-tools/_index.zh.md` | `list: products`、`aggregate: /tools` | 工具目录子树的正文集合，同一篇只显示一次 |
| 主题 `content/language/index.zh.md` | `list: choice` | `hugo.toml` 已启用的语言 |
| 主题 `content/appearance/index.zh.md` | `list: choice` | 跟随系统、浅色、深色 |

例如，站点有 `content/discover/example-tools/_index.zh.md` 工具目录，要使用产品表时，在该文件的 front matter 中加一行：

```yaml
list: products
```

列表仍包含原有子项，列改为名称、价格、价值说明；没有 `offer` 的文章显示价格 `—`。改成 `list: all` 就使用名称、更新时间、大小、路径列；改成 `list: directory` 就使用名称、更新时间、数量／大小列；改成 `list: name` 就只显示带图标的名称列。没有声明时，继承最近内容祖先的 `list`。普通文章仍使用 `page-article`，不会因祖先的列表声明变成列表。

新增普通列表目录时使用 `_index.<lang>.md`，声明 `layout: page-collection`、`list: directory` 和需要的 `slots.breadcrumb: true`；位于已有目录下时可继承布局和展示声明。正文只写介绍，列表自动在介绍后出现。单篇文章使用 `name.<lang>.md` 或 `name/index.<lang>.md`。

`aggregate` 只用于汇总入口，指向一个普通 section 根。它不从父目录继承。普通目录页无需写 `aggregate`，也不写 `list_source` 或 `product_filter`。主题默认页面的站点专用修改可通过项目同路径文件覆盖；三种语言各自保留完整 front matter。

Powered by 由主题 `content/powered-by/index*.md` 提供，使用 `page-powered-by` 展示技术总览，声明 `root_nav: true`、`weight: 96` 与 SVG `icon: code`。`powered-by` shortcode 展示 Banyan、Hugo 实际构建版本、本站内容版本和内嵌 PWA 状态面板。`params.theme_changelog` 指定 Banyan 变更记录地址；默认链接仓库的 `content/changelog/`。演示站点将它设为 `/changelog/`，复用 `page-collection` 与 `list: directory` 展示版本列表。记录只在根站点维护：开发期间写入 `content/changelog/unreleased/index.md`，发布时归档为 `content/changelog/v版本号/index.md`。主题版本来自 `hugo.Deps`。本站构建区域只显示内容版本；启用 SW 时，`sw-version.json` 使用同一内容版本。这里显示当前页面构建时的值，不实时查询浏览器的缓存状态。

PWA 状态面板直接位于总览页的 PWA 段落，`site_update.labels` 与技术说明同存于 `content/powered-by/index*.md`，不依赖其他内容页面。面板自行读取 registration，显示是否受 Service Worker 控制及检查/安装/等待状态；构建信息只在上方显示一次。检查按钮始终只检查，不激活或刷新。程序更新和激活由浏览器管理；普通链接、刷新、历史和锚点保持原生行为。

## 名称列表与公共样式

`list: name` 是完整的集合列表，默认按名称升序，点击名称列头切换升／降序，不按目录和文章分组。它使用与其他集合列表相同的成员、图标继承、`from`、路径列及历史恢复；页面内嵌 source payload 只携带名称列表需要的字段，不输出更新时间、计数或价格。普通目录列出直接子项及引用，汇总页仍显式声明 `aggregate`，不因为换成单列而改变收录范围。

例如将上述工具目录改成名称列表，只需在 `content/discover/example-tools/_index.zh.md` 增加 `list: name`。新建独立目录时可声明：

```yaml
layout: page-collection
list: name
slots:
  breadcrumb: true
```

`name` 描述内容作者看到的列表类型，`base` 描述样式实现层，因此没有 `list: base` 或 `list_columns`。`choice` 同样使用单列基底；语言／外观布局提供选项，语言与外观脚本分别处理操作，不需要先转成 `name` 集合。

`list` 由集合模型解析，决定渲染器输出的列表变体；`slots.breadcrumb` 决定路径区域是否存在。公共 DOM、行为标记与字段宽度见 [UI 命名与职责](/zh/p/ui-naming/#样式类与行为标记)，样式归属与发布边界见 [CSS 源码与发布名](/zh/p/ui-naming/#css-源码与发布名)。

集合页只有确实渲染 `.prose` 时才取得单一 `prose.css`；纯列表不会加载正文包。

## 站点信息与 RSS

站点信息页使用普通 `page-article`，声明 `build.list: local`、`slots.breadcrumb: true`。根页面设置 `root_nav: true` 后显示在第一列，不进入全站文章 RSS；点击入口先打开说明页面，外部目标由正文链接提供。

| 实体文件（三语言） | 内容职责 |
| --- | --- |
| 主题 `content/about/index*.md` | Banyan 介绍，站点可同路径覆盖内容与入口声明 |
| 主题 `content/github/index*.md` | Banyan 仓库说明，站点可同路径覆盖 |
| 主题 `content/rss/index*.md` | 当前语言的 RSS 订阅说明，正文调用 `{{</* rss-link */>}}` |

`layouts/_shortcodes/rss-link.html` 直接读取当前语言 `Site.Home.OutputFormats.Get "RSS"`，输出可点击的相对地址和可复制的绝对订阅地址，并在新标签打开。地址来自 Hugo 实际输出，不手写 `/zh/index.xml`，不复制 RSS 数据；使用该 shortcode 时首页需在 `[outputs].home` 启用 RSS。

栏目 RSS 与目录计数、汇总列表共用递归成员，包含子栏目的真实文章和 `_map.toml` 引用。
同一正文在一个 feed 中只出现一次，链接始终指向原文。首页 RSS 使用当前语言可列出的文章；
工具栏目使用相同规则；不同栏目的 RSS 可以收录同一篇文章。输出由 `[outputs]` 控制，条数使用 `[services.rss].limit`。

GitHub 和备案页的目标链接使用 `{{</* new-tab href="https://example.com/" */>}}链接文字{{</* /new-tab */>}}`，头像可在其中嵌套 `asset` 短代码；加粗可在短代码外侧使用 Markdown `**`。该短代码复用 `system-ui/link.html` 输出 `target="_blank"`、`rel="noopener noreferrer"`，不需要 JavaScript，也无需开启 Markdown 原始 HTML。第一列入口仍使用当前标签打开说明页。

正文中的小图标可使用 `{{</* asset src="badge.webp" alt="图标说明" class="md-inline-image" width="16" height="16" */>}}`。该 class 只排除普通正文图片的块布局、边框、内边距和阴影，保留浏览器默认的行内图片排版。图标与文字用普通空格分隔，可放进同一个链接，沿用普通链接的下划线。

## 统一更新时间

目录、内容全部视图和路径列的时间统一读取 Hugo `.Lastmod`，列名为“更新时间”。文章显示自身更新时间；非空目录汇总其递归文章集合的最新更新时间，包含引用。空目录使用自身 `.Lastmod`；没有有效时间的条目显示 `—`，排序值为空。

站点根 `hugo.toml` 配置 `[frontmatter] lastmod = ["lastmod", "date"]`：显式 `lastmod` 优先，未填写时使用手写 `date`，两者都没有则无有效更新时间。Git 提交和文件修改时间不参与文章更新时间。

文章 front matter 显式填写 `date` 和 `lastmod`：`date` 记录发布日期，初始 `lastmod` 与 `date` 相同，后续有实质内容更新时再手动调整 `lastmod`。整理分类、格式或目录时无需改动这两个字段。`blog` 与 `banyan` 新建文章模板会生成相同的初始日期；为已有文章补字段时复制其 `date`，保留原本已经填写的 `lastmod`。

显示和排序取同一 `.Lastmod`；显示到日，排序保留到秒。既有 `sort=date-asc/desc` URL 键保持不变，含义统一为更新时间，产品表仍只有名称、价格、价值说明三列。正文中的发布日期继续使用 `.Date`，不改变其含义；本站内容版本使用构建标识，不参与文章日期排序。

## 怎样声明条目图标

字符图标继承条目字号（当前为 15px），不再缩小到 `0.75em`。文字和 SVG 共用 `1.5rem` 宽的居中占位，容纳 `EN` 等短标记并保持名称起点一致；SVG 图形本身仍为 `1rem`。更新入口和检查更新页在三语言 front matter 声明 `icon: { text: "↻" }`，表示查看版本与检查更新，无需调整公共字号或占位。字符的具体字形由字体决定，需要严格一致的几何外观时使用 SVG。

SVG 名称来自 `data/icons.toml`，字符使用 `icon: { text: "©" }`，页面图片使用 `icon: { image: "0.webp" }`；三者都使用同一个 `icon` 值，不根据引号或是否命中图标库猜测类型。内容支持三个字段：`icon` 指定自己被列出时的图标，`list_icon_folder`／`list_icon_file` 分别指定本列表中的目录或分类／文章的默认图标。例如主题 `content/tools/_index.zh.md` 可以声明：

```yaml
icon: product
list: directory
list_icon_folder: folder
list_icon_file: product
```

`icon` 只描述该入口本身，不按同名字段继承。条目未声明 `icon` 时，由列出它的列表提供默认值；两个 `list_icon_*` 字段分别沿当前列表的真实祖先取最近的非空声明，最终默认为 `folder`／`file`。省略或空白表示继承，明确写 `folder`／`file` 可以覆盖祖先设置。条目自己的非空 `icon` 始终优先，SVG 名称去除首尾空白并统一为小写；对象必须包含一个非空字符串字段 `text` 或 `image`，保留大小写，仅图片对象允许额外声明布尔值 `monochrome`。`list_icon_folder` 与 `list_icon_file` 同样接受文字、图片对象，继承时整体替换。

图片统一调用现有 `system-assets/publish-local.html`：先查声明页面的 bundle，再查全站 `assets/`。例如页面声明 `icon: { image: "badge.webp" }` 时，读取该页面 bundle 内的 `badge.webp` 并发布为带哈希的资源；正文 `asset` 短代码也使用同一发布流程。页面也可声明 `icon: { image: "site/pwa/favicon.svg" }`，读取 `assets/site/pwa/favicon.svg`，发布为 `/site/pwa/favicon.<sha256>.svg`，与浏览器标签图标共用同一资源和 URL。全站资源路径不带 `assets/` 前缀；`./badge.webp` 则明确只从声明页面的 bundle 查找，缺失时不转查 assets。

图片默认值在声明目录解析后才继承，不会改成从子目录寻找同名文件。图片按 `1rem` 显示、保持比例，使用共用图标占位，无灯箱或正文图片的响应式变体。缺失资源、静态／远程 URL 和非图片文件会使构建失败。若页面自行声明 `build`，需同时保留 `publishResources: false`，避免覆盖全局 cascade 后又发布无哈希原图。语言配置中的图片以对应语言首页作为 bundle 上下文，同样支持全站 assets。

图片默认保留原色。需要跟随外观时，可声明 `icon: { image: "site/pwa/favicon.svg", monochrome: true }`。共用图标样式在浅色使用 `brightness(0)`、深色使用 `brightness(0) invert(1)`，分别显示纯黑／纯白，并保留透明度；手动切换或跟随系统都生效。它只改变当前图标元素的显示，不修改源文件、发布文件或哈希 URL，也不会让共用图片的浏览器 favicon、正文头像自动变色。此选项适合有透明背景的单色图形；多色细节会统一变成黑／白。省略或 `false` 均保留原色，不接受字符串 `"true"`。第一列、主列表及动态路径列都保留同一声明。

主题在 `content/tools/_index*.md` 和 `content/all-tools/_index*.md` 各声明 `list_icon_file: product`，产品分类子页继承分类根的设置。未声明 `icon` 的文章使用当前列表的默认图标；需要在所有入口使用同一图标时，在文章各语言文件中声明 `icon`。

`aggregate` 只提供集合成员，不参与默认图标继承；`/all-tools/` 与 `/tools/` 是兄弟入口，所以各自声明一次。普通文章只允许 `icon`；目录、分类及主题支持的列表布局可以声明子项默认值，包括以 `index.md` 实现的 `/all/`。误把 `list_icon_*` 配在普通文章上，或填写未定义的图标名称，构建会报错并指出页面和字段。第一列将首页自身与直属入口一起渲染，使用首页的目录默认值或条目自身的 `icon`。访问首页只选中首页，其他页面按真实入口或有效来源选中。

图标值由 `system-ui/icon/resolve.html` 校验，`system-ui/icon/page-value.html` 在读取页面声明时解析并发布图片，`system-ui/icon/render.html` 接收解析后的值统一输出文字、SVG 或图片。浏览器用 `assets/js/browse/icon-value.js` 保留同样的值结构，JSON 编解码不得把对象转成字符串。默认值实现集中在 `system-ui/list/icon-defaults.html`（解析列表默认值）和 `system-ui/list/item-icon.html`（自身声明优先）。`feature-browse/collection/rows.html` 为每行写入最终 `icon`，主表、页面内嵌 source payload 和路径列共用；站点列表与第一列也调用相同规则。`feature-browse/navigation/source/register-icons.html` 只为命名 SVG 收集依赖，文字、图片不加入 sprite。浏览器选择／排序逻辑和现有列表数据协议不变。

## 怎样声明选择列表

语言和外观页面在顶层 front matter 声明 `list: choice`，与 `build.list: local` 是两件事：前者选择行的呈现协议，后者控制 Hugo 是否把页面列入父页面集合。`choice` 使用与其他列表相同的行、图标槽和 `.is-current` 状态，但不排序、不注册 collection 来源，也不参与文章路径。

选择列表的标题由布局传入，显示“语言／外观”。语言按配置 `weight` 排列，外观按“跟随系统、浅色、深色”排列，列头不显示排序操作或箭头。公共列头与条目样式见 [UI 命名与职责](/zh/p/ui-naming/#样式类与行为标记)。

选择列表只接受两种原生控件：链接或按钮。`system-ui/choice/render.html` 校验选项，再调用公共列表，保留标题的 `h1` 结构。`system-ui/list/item-link.html` 与 `item-button.html` 负责原生控件；`item-content.html` 负责文字和图标。页面布局提供选项，功能脚本只响应自己的标记。语言项保留真实 `href` 和 `data-language-choice`，无 JavaScript 时仍可切换；外观项使用按钮和 `data-theme-choice`。模板不认识语言代码或主题值，front matter 也不声明脚本文件。

选择按钮显式传入 `ariaPressed` 的 `"true"` 或 `"false"`。更新检查操作使用同一个按钮模板，省略此状态；按钮将 `labelAttr` 传给文字模板，保留更新脚本使用的文案标记。

外观的三个子项在 `layouts/page-appearance.html` 中通过 `icon` 分别引用 `appearance-auto`、`appearance-light`、`appearance-dark`，图形定义在 `data/icons.toml`。三个 SVG 使用相同的 `16×16` 画布、圆心、半径和描边，分别呈半实心、空心、实心，避免 Unicode 字体回退造成尺寸不一致。颜色继承 `currentColor`，图形为 `1rem`，复用共享占位及按需 sprite；图标不参与按钮的可访问名称。第一列入口继续使用页面声明的 `icon: theme` 云月图标，语言项使用相同的 `icon: { text: "…" }`，不再传递 `iconText`。

语言名称、顺序和启用状态仍以根项目 `hugo.toml` 的 `[languages]` 为事实源。可在对应语言参数中设置短文字图标：

```toml
[languages.en.params]
locale = "en_US"
icon = { text = "EN" }
```

Module 为英语、简体中文和繁体中文提供 `EN`、`简`、`繁` 文字图标；
站点可用 `icon` 覆盖。其他语言未设置 `icon` 时使用主题的语言 SVG。

语言页的选择仍留在设置页；返回原内容时优先打开刚选语言的真实译文。此行为由语言脚本处理，不属于 `choice` 渲染协议，具体规则见 [系统页面与返回](/zh/p/navigation-state/#系统页面与返回)。

## 怎样收录工具

将文章放入工具目录，或在工具子目录的 `_map.toml` 中引用已有正文。例如
`content/tools/free/_map.toml`：

```toml
refs = ["/discover/example-tool"]
```

工具正文只声明展示信息，不写分类字段：

```yaml
offer:
  amount: 0
  currency: "$"
  value: "工具说明"
```

`offer` 可省略，或只写 `value`；填写 `amount` 时必须提供 `currency`，金额需为非负数字。
未标价显示 `—`，价格升序和降序均排在已标价项后；0 显示本语言的“免费”。
价值说明缺失时留空。价格和价值字段不决定文章进入哪个栏目。

每个工具栏目使用 `content/tools/<目录>/_index.<lang>.md` 设置标题与介绍，
继承工具根的产品列表布局。列表的排序由用户当前选择决定。
`all-tools` 汇总工具目录子树的正文，同一篇文章经多个目录引用时只显示一次。

## 来源与排序

从栏目进入文章时，路径导航保留该次来源；直接打开正文时，显示文章的实际目录路径。
排序和浏览器前进、后退会保留各自的来源与排序状态。

同一名称顺序由 Hugo 生成，主表和路径列使用相同结果。更新时间相同时，名称作为后续排序依据。

`/tools/` 是工具栏目根，`/all-tools/` 是工具全部。两者收录范围不同。
技术说明见[路径模型](/zh/p/breadcrumb-models/)和[导航状态](/zh/p/navigation-state/)。
