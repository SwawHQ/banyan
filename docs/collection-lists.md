# 列表与产品声明

页面的 `list` 只声明子项怎么展示。内容集合的成员来自页面本身的目录或 Hugo 分类关系；选择页的选项由对应布局提供。入口归属继续由真实根页面及有效 `from` 决定，不在内容 front matter 中写菜单。

第一列名称使用页面的 `linkTitle`，未声明时使用 `title`。语言、外观、我的的三语言主题页面直接使用无“系统－／系統－／System -”前缀的 `title`，入口与页内标题共用同一名称，无需重复声明 `linkTitle`。

第一列采用显式加入：只有根页面顶层声明布尔值 `root_nav: true` 才显示；未声明、`false` 或字符串 `"true"` 均不显示。首页自身也遵守该规则。此字段只对首页及其直接子页／分类根生效，不能把深层文章提升成根入口；不要放入 `cascade`。项目覆盖主题页面时，每种语言各自保留该声明。

入口名称和顺序由站点各语言页面的 `title`／`linkTitle` 与 `weight` 决定。

使用工具分类时，在站点 `hugo.toml` 注册 `tool = "tools"`，文章用 `tools: [free, first-party]` 归类，全部入口声明 `aggregate: /tools`。主题默认入口位于 `content/tools/`、`content/all-tools/`。`list: products`、`offer`、`products_*` 文案键与 `product` 图标保留通用产品展示语义，与分类法名称独立。

`/d/` 不声明 `root_nav`。它继续渲染目录页，文章的目录来源、集合成员、排序、`from` 及路径列均保留。隐藏来源没有对应的第一列选中项；直接访问正文时若实际根为隐藏的 `/d/`，同样不选中第一列。可见入口过滤仅发生在 `feature-browse/navigation/root/render.html`，`feature-browse/navigation/root/pages.html` 保留完整结构供归属与来源模型使用。

## 在哪里改表格

| 文件（每种语言分别配置） | 当前声明 | 列出的对象 |
| --- | --- | --- |
| 主题 `content/d/_index.zh.md` | `list: directory` | 目录的直接子目录、文章 |
| 项目 `content/d/wsl/_index.zh.md` | 未声明，继承 `/d/` | WSL 目录的直接子项 |
| 项目 `content/tags/_index.zh.md` | `list: directory` | 现有标签树的子项 |
| 项目 `content/tools/_index.zh.md` | `list: directory` | Hugo 的工具分类词项，包含显式空分类 |
| 上述文件的 `cascade`，目标 `kind: term` | `list: products` | 每个分类的 `.Pages`，无需逐类写来源 |
| 项目 `content/all/index.zh.md` | `list: all`、`aggregate: /d` | `/d/` 下全部内容 |
| 项目 `content/all-tools/_index.zh.md` | `list: products`、`aggregate: /tools` | 工具分类成员的去重并集 |
| 主题 `content/language/index.zh.md` | `list: choice` | `hugo.toml` 已启用的语言 |
| 主题 `content/appearance/index.zh.md` | `list: choice` | 跟随系统、浅色、深色 |

比如要让 WSL 目录使用产品表，在项目 `content/d/wsl/_index.zh.md` 原有 front matter 内加一行：

```yaml
list: products
```

原有 WSL 文章仍全部保留，只把列换成名称、价格、价值说明；没有 `offer` 的文章显示价格 `—`。改成 `list: all` 就使用名称、更新时间、大小、路径列；改成 `list: directory` 就使用名称、更新时间、数量／大小列；改成 `list: name` 就只显示带图标的名称列。没有声明时，继承最近内容祖先的 `list`。普通文章仍使用 `page-article`，不会因祖先的列表声明变成列表。

新增普通列表目录时使用 `layout: page-collection`、`list: directory` 和需要的 `slots.breadcrumb: true`；位于已有目录下时可继承布局和展示声明。正文只写介绍，表格自动在介绍后出现，旧的 `section-list`、`taxonomy-list`、`all-list`、`products-list` shortcode 已删除。

`aggregate` 只用于汇总入口，指向一个 section 或 taxonomy 根。它不从父目录继承。普通目录和分类页无需写 `aggregate`，也不写 `list_source` 或 `product_filter`。主题默认页面的站点专用修改可通过项目同路径文件覆盖；三种语言各自保留完整 front matter。

Powered by 由主题 `content/powered-by/index*.md` 提供，使用 `page-powered-by` 展示技术总览，声明 `root_nav: true`、`weight: 96` 与 SVG `icon: code`。`powered-by` shortcode 展示 Banyan、Hugo 实际构建版本、站点构建信息和内嵌 PWA 状态面板。`params.theme_changelog` 指定 Banyan 变更记录地址；默认链接仓库的 `content/changelog/`。演示站点将它设为 `/changelog/`，复用 `page-collection` 与 `list: directory` 展示版本列表。记录只在根站点维护：开发期间写入 `content/changelog/unreleased/index.md`，发布时归档为 `content/changelog/v版本号/index.md`。主题版本来自 `hugo.Deps`；站点可通过 `params.build.theme` 提供提交和未提交修改状态。

PWA 状态面板直接位于总览页的 PWA 段落，`site_update.labels` 与技术说明同存于 `content/powered-by/index*.md`，不依赖其他内容页面。面板显示是否受 Service Worker 控制及检查/安装/等待状态；构建信息只在上方显示一次。检查按钮始终只检查，不激活或刷新。普通站内同标签页链接在已有 waiting worker 时先激活再跳转，其他标签页不重载；刷新、历史和锚点保持原生行为。

旧更新目录、主题及根站点的 changelog 占位页、`changelog-fallback` shortcode 已移除，构建信息并入技术总览。已有 `data/redirects.toml` 中旧 PWA/site 迁移的目标同步指向新路径。总览是根级普通页面，不再保留 PWA 子页、子页路径列及其专用布局。

## 名称列表与公共样式

`list: name` 是完整的集合列表，默认按名称升序，点击名称列头切换升／降序，不按目录和文章分组。它使用与其他集合列表相同的成员、图标继承、`from`、路径列及历史恢复；页面内嵌 source payload 只携带名称列表需要的字段，不输出更新时间、计数或价格。普通目录列出直接子项，分类页列出分类成员，汇总页仍显式声明 `aggregate`，不因为换成单列而改变收录范围。

例如将已有 WSL 目录改成名称列表，只需在 `content/d/wsl/_index.zh.md` 增加 `list: name`。新建独立目录时可声明：

```yaml
layout: page-collection
list: name
slots:
  breadcrumb: true
```

`name` 描述内容作者看到的列表类型，`base` 描述样式实现层，因此没有 `list: base` 或 `list_columns`。`choice` 同样使用单列基底；语言／外观布局提供选项，语言与外观脚本分别处理操作，不需要先转成 `name` 集合。

| 样式文件 | 职责 |
| --- | --- |
| `assets/css/collection-item.css` | 共用条目行、图标占位、链接／按钮 reset、悬停及选中状态 |
| `assets/css/collection-grid.css` | `.collection-list` 默认单列、列头、网格间距和路径列行结构，供 name、choice、第一列、路径列及多列表格共同使用 |
| `assets/css/collection-table.css` | 多列表格的滚动、字段呈现，以及 `.collection-list--directory`、`--all`、`--products` 三种列定义 |

`list` 由集合模型解析，决定渲染器输出的列表变体；`slots.breadcrumb` 决定路径区域是否存在。`system-ui/page-styles.html` 统一发布稳定的 `page.css`，其中包含三个集合样式文件以及路径、元信息和两个小型入口功能的样式。CSS 由对应类名匹配生效，不再按 view／slot 组合生成近乎相同的文件。SSR 与动态路径列统一使用 `.collection-*` 类名，旧 `grid-*`／`cell-*` 选择器已删除。根入口、路径列、主列表和 choice 的条目状态统一由 `collection-item.css` 所有。

公共单列无需单独的名称列表 CSS；带列头的网格使用 `.collection-list--headed`，多列表格使用 `.collection-list--table`，路径列使用 `.collection-list--path-column`。`.collection-panel` 仅限制容器宽度，不被视为列表。集合页只有确实渲染 `.prose` 时才取得单一 `prose.css`；纯列表不会加载正文包。

行为连接独立于样式：每个单元格有 `data-collection-cell="name|date|count|size|path|price|value"`，列头另有 `data-collection-header`；可进入的条目或选择按钮有 `data-collection-entry`，排序箭头有 `data-sort-indicator`。排序按这些标记和既有 `data-sort-*` 数据处理。样式分工见 [UI 命名与职责](ui-naming.md#css-源码与发布名)。

## 站点信息与 RSS

站点信息页使用普通 `page-article`，声明 `build.list: local`、`slots.breadcrumb: true`。根页面设置 `root_nav: true` 后显示在第一列，不进入全站文章 RSS；点击入口先打开说明页面，外部目标由正文链接提供。

| 实体文件（三语言） | 内容职责 |
| --- | --- |
| 主题 `content/about/index*.md` | Banyan 介绍，站点可同路径覆盖内容与入口声明 |
| 主题 `content/github/index*.md` | Banyan 仓库说明，站点可同路径覆盖 |
| 主题 `content/rss/index*.md` | 当前语言的 RSS 订阅说明，正文调用 `{{< rss-link >}}` |

`layouts/_shortcodes/rss-link.html` 直接读取当前语言 `Site.Home.OutputFormats.Get "RSS"`，输出可点击的相对地址和可复制的绝对订阅地址，并在新标签打开。地址来自 Hugo 实际输出，不手写 `/zh/index.xml`，不复制 RSS 数据；使用该 shortcode 时首页需在 `[outputs].home` 启用 RSS。

GitHub 和备案页的目标链接使用 `{{< new-tab href="https://example.com/" >}}链接文字{{< /new-tab >}}`，头像可在其中嵌套 `asset` 短代码；加粗可在短代码外侧使用 Markdown `**`。该短代码复用 `system-ui/link.html` 输出 `target="_blank"`、`rel="noopener noreferrer"`，不需要 JavaScript，也无需开启 Markdown 原始 HTML。第一列入口仍使用当前标签打开说明页。

正文中的小图标可使用 `{{< asset src="badge.webp" alt="图标说明" class="md-inline-image" width="16" height="16" >}}`。该 class 只排除普通正文图片的块布局、边框、内边距和阴影，保留浏览器默认的行内图片排版。图标与文字用普通空格分隔，可放进同一个链接，沿用普通链接的下划线。

## 统一更新时间

目录、分类、内容全部视图和路径列的时间统一读取 Hugo `.Lastmod`，列名为“更新时间”。文件显示自身更新时间；非空目录／分类汇总其包含内容的最新更新时间，目录递归到后代内容，树形分类也包含下级分类。空目录使用自身 `.Lastmod`，空分类及其他没有有效时间的条目显示 `—`，排序值为空。

主题与项目 `hugo.toml` 配置 `[frontmatter] lastmod = ["lastmod", "date"]`：显式 `lastmod` 优先，未填写时使用手写 `date`，两者都没有则无有效更新时间。Git 提交和文件修改时间不参与文章更新时间；`enableGitInfo = true` 仍为更新记录页提供源码提交信息。

文章 front matter 显式填写 `date` 和 `lastmod`：`date` 记录发布日期，初始 `lastmod` 与 `date` 相同，后续有实质内容更新时再手动调整 `lastmod`。整理分类、格式或目录时无需改动这两个字段。`blog` 与 `banyan` 新建文章模板会生成相同的初始日期；为已有文章补字段时复制其 `date`，保留原本已经填写的 `lastmod`。

显示和排序取同一 `.Lastmod`；显示到日，排序保留到秒。既有 `sort=date-asc/desc` URL 键保持不变，含义统一为更新时间，产品表仍只有名称、价格、价值说明三列。正文中的发布日期继续使用 `.Date`，不改变其含义；检查更新页中的版本时间仍是构建时间。

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

图标值由 `system-ui/icon/resolve.html` 校验，`system-ui/icon/page-value.html` 在读取页面声明时解析并发布图片，`system-ui/icon/render.html` 接收解析后的值统一输出文字、SVG 或图片。浏览器用 `assets/js/browse/icon-value.js` 保留同样的值结构，JSON 编解码不得把对象转成字符串。默认值实现集中在 `system-ui/list/icon-defaults.html`（解析列表默认值）和 `system-ui/list/item-icon.html`（自身声明优先）。`feature-browse/collection/rows.html` 为每行写入最终 `icon`，主表、页面内嵌 source payload 和路径列共用；站点列表、第一列及首页快捷列表也调用相同规则。`feature-browse/navigation/source/register-icons.html` 只为命名 SVG 收集依赖，文字、图片不加入 sprite。浏览器选择／排序逻辑和现有列表数据协议不变。

## 怎样声明选择列表

语言和外观页面在顶层 front matter 声明 `list: choice`，与 `build.list: local` 是两件事：前者选择行的呈现协议，后者控制 Hugo 是否把页面列入父页面集合。`choice` 使用与其他列表相同的行、图标槽和 `.is-current` 状态，但不排序、不注册 collection 来源，也不参与文章路径。

选择列表的标题由布局传入，作为网格内的 `h1` 列头，显示“语言／外观”。它与目录表共用列头高度、间距和表头横线；共享标题单元格使用 flex 排布，避免文字图标与 SVG 的不同基线撑出额外行高。语言按配置 `weight` 排列，外观按“跟随系统、浅色、深色”排列，列头不显示排序操作或箭头。

选择列表只接受两种原生控件：链接或按钮。共享模板负责文字、图标、选中样式、可访问状态和 `data-*` 输出；页面布局负责提供选项，功能脚本只响应自己的标记。语言项保留真实 `href` 和 `data-language-choice`，无 JavaScript 时仍可切换；外观项使用按钮和 `data-theme-choice`。模板不认识语言代码或主题值，front matter 也不声明脚本文件。

外观的三个子项在 `layouts/page-appearance.html` 中通过 `icon` 分别引用 `appearance-auto`、`appearance-light`、`appearance-dark`，图形定义在 `data/icons.toml`。三个 SVG 使用相同的 `16×16` 画布、圆心、半径和描边，分别呈半实心、空心、实心，避免 Unicode 字体回退造成尺寸不一致。颜色继承 `currentColor`，图形为 `1rem`，复用共享占位及按需 sprite；图标不参与按钮的可访问名称。第一列入口继续使用页面声明的 `icon: theme` 云月图标，语言项使用相同的 `icon: { text: "…" }`，不再传递 `iconText`。

语言名称、顺序和启用状态仍以根项目 `hugo.toml` 的 `[languages]` 为事实源。可在对应语言参数中设置短文字图标：

```toml
[languages.en.params]
locale = "en_US"
icon = { text = "EN" }
```

站点可选择 `EN`、`简`、`繁` 等文字图标。未设置 `icon` 时使用主题的语言 SVG。

语言页的选择仍留在设置页；返回原内容时优先打开刚选语言的真实译文。此行为由语言脚本处理，不属于 `choice` 渲染协议，具体规则见 [系统页面与返回](navigation-state.md#系统页面与返回)。

## 怎样收录工具

在站点 `hugo.toml` 注册 `tool = "tools"`，再为工具文章添加分类和展示信息，例如 `content/d/example-tool/index.zh.md`：

```yaml
tools: [free, first-party]
offer:
  amount: 0
  currency: "$"
  value: "工具说明"
```

至少一个非空工具词项才构成工具收录。词项由作者自由定义，例如 `tools: [paid, "$5~$50", "Special Tools"]`，无需改模板或新增分类文件。系统不解释分类含义、不检查互斥，也不从价格推导分类。`offer` 可省略，或只写 `value`；填写 `amount` 时必须提供 `currency`，金额需为非负数字。未标价显示 `—`，价格升序和降序均排在已标价项后；0 显示本语言的“免费”。价值说明缺失时留空。

Hugo 自动生成 `/tools/<词项>/`。需要译名、介绍、权重或显式空分类时，再创建项目 `content/tools/<词项>/_index.zh.md`，例如：

```yaml
---
title: 自建
weight: 30
---
```

这些是普通分类内容元数据。表格遵循当前列排序，`weight` 不覆盖用户选择的排序。词项及各语言内容由站点维护，主题没有固定分类白名单。

## 来源与排序

主表和页面内嵌的路径来源共用 `feature-browse/collection/rows.html`；一个列表页只注册一次 `collection` 来源。目录／分类关系适配分别在 `feature-browse/collection/rows/section.html`、`feature-browse/collection/rows/taxonomy.html`，展示在 `feature-browse/collection/render.html`。排序字段由 `feature-browse/collection/config.html` 解析 `list` 后给出，浏览器不按路径或 provider 猜表格种类。

名称比较由 Hugo 执行一次，生成 `sort_name` 数值名次，显示文字仍保留在 `text`。这样首帧、主表与路径列使用同一名称顺序，不因浏览器语言或 ICU 实现不同而换位。更新时间降序中时间相同的条目也使用名称降序；升序相反。实现依据见 [Hugo 的稳定排序实现](https://github.com/gohugoio/hugo/blob/v0.157.0/tpl/collections/sort.go)。

`/tools/` 是分类根，工具全部是 `/all-tools/`。

新链接分别携带 `from=tools/free`、`from=all-tools`，分类根 `from=tools` 不代表工具全部。无效来源按通用规则使用文章的真实目录路径；原生后退恢复历史中的文章网址及其来源／排序。

## 验证

运行 `swban node tests/nav/rebuild.mjs` 可验证 Hugo 开发预览的增量重建：使用根站点内容和临时目录标题覆盖层，先访问正文，再修改祖先标题，检查三语言正文元信息同步更新。路径模型每次渲染读取当前祖先，不能存入跨增量重建保留的页面 Scratch，否则祖先改名后可能继续输出旧名称。

路径来源直接内嵌在各语言页面，使用当前语言模型的 `current_collection_items` 和祖先层 `collection_items`。浏览器在页面边界一次解码，主表与路径列使用同一份语言和排序事实。

在根项目执行 `swban node tests/collections/build.mjs`。它只向系统临时目录写内容覆盖层，完成后清理，基于根内容构建 directory／all／products／name 四种样式，验证三语言成员不变、继承／覆盖、自动分类、显式空分类、去重、未分类排除、缺失价格及文章进入后的路径顺序。name 用例同时覆盖目录、子目录继承、分类、聚合入口，检查首帧仅名称列、名称升降序、进入文章后的路径列、刷新及历史恢复。时间用例覆盖发布日期与更新时间不同、只填更新时间、默认日期来源、完全无时间、目录／平面与树形分类汇总，以及升降序进入文章后的路径顺序。图标用例覆盖两种默认值独立继承、局部与自身覆盖、汇总入口独立性、首帧菜单、来源专用 SVG、刷新及前进后退，并确认非法声明使构建失败。原有浏览器回归继续覆盖画幅、首帧、排序、系统返回和历史导航。
