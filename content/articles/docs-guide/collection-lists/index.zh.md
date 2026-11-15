---
title: 内容 · 列表、图片墙与产品
date: 2026-11-06
lastmod: 2026-11-15
url: p/collection-lists/
description: 配置目录、引用、条目图标和产品列表。
---

页面的 `layout` 选择列表字段和行为。普通目录的成员来自实际文章和本目录 `_map.toml` 的引用。选择页的选项由对应布局提供。自定义字段放在 `params`，继承默认值放在 `cascade.params`。

## 在哪里改列表

在栏目的 `_index.<lang>.md` 中选择 `layout`。以下路径使用 Banyan 参考站的命名；站点可以自行命名栏目。

| 用途 | layout | 收录范围 |
| --- | --- | --- |
| 普通栏目 | `page-collection-directory` | 直属子栏目、文章和引用 |
| 名称列表 | `page-collection-directory-name-only` | 同上，只显示名称 |
| 产品列表 | `page-collection-products` | 直属子项和引用，显示产品字段 |
| 文章汇总 | `page-collection-directory-all` | `params.aggregate` 指定栏目及下级文章和引用 |
| 产品汇总 | `page-collection-products-all` | 同上，显示产品字段 |

例如，在 `content/products/examples/_index.zh.md` 中选择产品列表：

```yaml
layout: page-collection-products
```

列表仍包含原有子项，产品布局显示名称、更新时间、价格，默认按更新时间倒序；没有 `params.offer` 的文章显示价格 `—`。`page-collection-directory-all` 显示名称、更新时间和大小，且需指定 `params.aggregate`；`page-collection-directory` 显示名称、更新时间、数量／大小；`page-collection-directory-name-only` 只显示带图标的名称。布局可沿内容祖先的 `cascade` 继承。普通文章使用 `page-article-rss` 或 `page-article-norss`，不会因栏目布局变成列表。

新增普通列表目录时使用 `_index.<lang>.md`，声明 `layout: page-collection-directory` 和需要的 `params.slots: [breadcrumb]`；位于已有目录下时可继承布局和区域声明。正文只写介绍，列表显示在介绍之前。单篇文章使用 `name/index.<lang>.md` 叶子包。

`params.aggregate` 只用于名称以 `-all` 结尾的汇总布局，指向一个普通 section 根。普通目录页无需写 `aggregate`。所有页面直接在站点根 `content/` 维护；各语言维护各自的页面字段。

## 普通栏目图片墙

普通栏目的 `_index*.md` 使用 `page-collection-wall`，显示直属子栏目、文章及引用。目录在前，文章在后；文章按发布日期倒序。它与下方汇总图片墙共用 `params.wall` 配置。

```yaml
layout: page-collection-wall
params:
  slots: [breadcrumb]
  wall:
    size: {width: auto, height: 200}
    details: title
    scroll: horizontal
```

点击封面进入目录或文章；点击标题或细点打开同一种详情浮窗。目录用小图标区分，说明和文章数放在浮窗内。目录封面取包内 `cover.*`；无封面时显示该目录的 `description`，说明为空或与标题相同时，居中显示站点图标。

只有当前列显示图片墙。进入子目录后，父列使用原有紧凑导航；子目录按自己的 layout 显示。要让下级栏目也使用图片墙，在 `cascade` 中为 `target: {kind: section}` 设置该 layout、`params.wall` 和 `params.slots: [breadcrumb]`。这些排列配置只给栏目，文章的 `params.wall` 仍用于封面。

## 汇总图片墙

首页或普通汇总栏目的 `_index*.md` 可使用 `page-collection-wall-all`。它读取 `aggregate` 栏目及下级文章、引用，去重后按发布日期倒序显示。不会显示子栏目卡片。

```yaml
layout: page-collection-wall-all
params:
  aggregate: /articles
  wall:
    size:
      width: auto
      height: 200
    details: title
    scroll: horizontal
```

| 配置 | 可选值 | 默认值 |
| --- | --- | --- |
| `size.width` | 目标宽度，CSS px；`auto` 按原图比例计算 | `200` |
| `size.height` | 目标高度，CSS px；`auto` 按原图比例计算 | `auto` |
| `details` | `title` 一行标题、`overlay` 图内细点常显、`overlay-hover` 悬停显示（触屏常显） | `title` |
| `scroll` | `horizontal` 横向、`vertical` 竖向 | `vertical` |

宽高均为数值时使用固定比例网格，例如 `300 × 200` 为 3:2，封面居中裁剪。`200 × auto` 使用等宽瀑布流，`auto × 200` 使用等高排列，两者保留原图比例。

尺寸不含标题与间距，是卡片的最大尺寸；空间不足时缩小，不放大补满空白。点击图片进入文章，点击标题或细点查看完整标题、所属栏目和发布日期。图片墙不显示排序栏、栏目介绍或页面页脚。

文章叶子包放置 `cover.jpg`、`cover.png` 等栅格封面，或在文章 front matter 指定包内文件：

```yaml
params:
  wall:
    cover: photo.jpg
    alt: 山间的雾
    kind: image
```

未指定文件时读取包内 `cover.*`；没有封面时居中显示 `assets/site/favicon.link.svg`，缺少时使用 `assets/site/favicon.ico`。目录独立说明使用正文字号。`kind: video` 只显示三角标记，点击仍进入文章，视频由文章正文提供。封面由构建处理为带指纹的 WebP，不读取继承的分享图片。

参考站首页使用风场，栏目使用列表；首页和栏目配置中保留了 300 × 125 图片墙参数注释。启用时改用注释所标明的图片墙 layout，取消 params.wall 的注释；首页还需启用 aggregate 并移除 home-art 短代码。切换艺术首页时，将 `layout` 改为 `page-home`，移除 `aggregate` 与 `wall`，恢复正文中的 `{{</* home-art "/_res/home-art/wind" */>}}`；切回图片墙时移除该短代码。`show_navigation` 在两种首页中均有效。各语言分别配置，风场资源包可以保留。

## 名称列表与公共样式

`page-collection-directory-name-only` 是完整的名称列表，默认按名称升序，点击名称列头切换升序或降序，不按目录和文章分组。它使用相同的成员和图标规则，保留浏览来源；不显示更新时间、计数或价格。名称列表列出直接子项及引用；汇总成员须选用相应的 `-all` 布局。

例如将上述产品目录改成名称列表，只需把 `layout` 改为 `page-collection-directory-name-only`。新建独立目录时可声明：

```yaml
layout: page-collection-directory-name-only
params:
  slots: [breadcrumb]
```

语言与外观设置使用下方的选择列表布局。

## 统一更新时间

目录、内容全部视图、产品列表和面包屑列的时间统一读取 Hugo `.Lastmod`，列名为“更新时间”。文章显示自身更新时间；非空目录汇总其递归文章集合的最新更新时间，包含引用。空目录使用自身 `.Lastmod`；没有有效时间的条目显示 `—`，排序值为空。

站点根 `hugo.toml` 配置 `[frontmatter] lastmod = ["lastmod", "date"]`：显式 `lastmod` 优先，未填写时使用手写 `date`，两者都没有则无有效更新时间。Git 提交和文件修改时间不参与文章更新时间。

`date` 记录发布日期，`lastmod` 记录内容更新时间。参考配置在未填写 `lastmod` 时使用 `date`，无需为已有文章重复补写相同日期。新建文章模板会生成初始日期；有实质内容更新时再修改 `lastmod`。整理分类、格式或目录时无需修改日期。

正文分别显示发布日期与更新时间。列表的初始顺序见[默认排序](#默认排序)。

## 怎样声明条目图标

SVG 名称来自站点根 `assets/site/icons.toml`，例如 `icon: folder`。字符使用 `icon: {text: "©"}`，图片使用 `icon: {image: "0.webp"}`。内容支持三个字段：`icon` 指定自己被列出时的图标，`list_icon_folder`／`list_icon_file` 分别指定本列表中的目录或分类／文章的默认图标。例如产品栏目的 `content/products/_index.zh.md` 可以声明：

```yaml
layout: page-collection-directory
params:
  icon: product
  list_icon_folder: folder
  list_icon_file: product
```

`icon` 指定条目自身图标，优先于列表默认值。条目未设置时，由列出它的列表提供默认图标。`list_icon_folder` 和 `list_icon_file` 沿当前列表的真实祖先继承，最终默认为 `folder` 和 `file`；写入新值可覆盖继承值。

图片先查声明页面的页面包，再查全站 `assets/`。例如 `icon: {image: "badge.webp"}` 使用页面包图片，`icon: {image: "site/favicon.link.svg"}` 使用全站资源；`./badge.webp` 只查页面包。图片默认值从声明目录解析后再继承，不会改为读取子目录的同名图片。

需要单色图标跟随外观时，使用 `icon: {image: "site/favicon.link.svg", monochrome: true}`。浅色显示黑色，深色显示白色；适合透明背景的单色图形，多色细节会合并。省略 `monochrome` 时保留原色。此设置不改变共用该文件的 favicon 或正文图片。

`aggregate` 只选择成员，不继承来源栏目的图标设置。`products-all` 与 `products` 是兄弟入口，需要分别声明列表默认图标；普通文章只设置自身 `icon`。

## 怎样声明选择列表

语言和外观页面使用 `_index.<lang>.md`，分别声明 `page-collection-language`、`page-collection-appearance` 和 `outputs: [HTML]`。这两种布局提供固定选项，不提供列表排序。

语言选项按配置 `weight` 排列；外观选项依次为“跟随系统、浅色、深色”。

在外观设置页的 `params.appearance_icons` 中指定三个选项的图标。图形定义在 `assets/site/icons.toml`；也可选择文字或图片。第一列入口继续使用页面声明的 `params.icon`。

```yaml
params:
  icon: theme
  appearance_icons:
    auto: appearance-auto
    light: appearance-light
    dark: appearance-dark
```

语言名称、顺序和启用状态仍以根项目 `hugo.toml` 的 `[languages]` 为事实源。选项图标由目标语言设置页的 front matter 提供：

```yaml
# content/language/_index.md
params:
  icon: language
  language_icon: { text: "EN" }
```

演示站为英语、简体中文和阿拉伯语配置 `EN`、`简`、`ع` 文字图标。
未设置 `language_icon` 时使用主题的语言 SVG。

语言页的选择仍留在设置页；返回原内容时优先打开刚选语言的真实译文。具体规则见 [系统页面与返回](/zh/p/navigation-state/#系统页面与返回)。

## 怎样收录产品

将文章放入产品目录，或在产品子目录的 `_map.toml` 中引用已有正文。Banyan 演示的
`content/products/examples/_map.toml` 如下；填写本站的正文路径：

```toml
refs = ["/articles/category1/example"]
```

产品正文只声明展示信息，不写分类字段：

```yaml
params:
  offer:
    amount: 0
    currency: "$"
    version: "1.0.0"
```

不展示价格时可省略 `offer`。展示价格时，填写金额 `amount` 和币种 `currency`。
未标价显示 `—`，价格升序和降序均排在已标价项后；0 显示本语言的“免费”。
`version` 可保留为产品定义值，列表不显示，也不按它排序。价格和版本字段不决定文章进入哪个栏目。

## 默认排序

在栏目首页的 front matter 中设置默认排序。例如，按名称升序排列：

```yaml
params:
  default_sort: name-asc
```

`asc` 表示升序，`desc` 表示降序。可选字段如下：

| 列表 | 字段 |
| --- | --- |
| 名称列表 | `name`（名称） |
| 普通目录 | `name`、`date`（更新时间）、`count`（数量） |
| 汇总文章列表 | `name`、`date`、`size`（大小） |
| 产品列表 | `name`、`date`、`price`（价格） |

未配置时，名称列表按名称升序，其余上述列表按更新时间降序。读者仍可点击列标题切换排序。

每个栏目独立排序。进入子栏目时使用子栏目的默认排序，父栏的手动排序不会传给子栏。返回已有页面或打开带排序状态的链接时，恢复对应栏目的排序。

## 来源与排序

从栏目进入文章时，面包屑导航保留该次来源；直接打开正文时，显示文章的实际目录路径。
各列独立排序，新标签打开的链接也保留最新状态。
排序和浏览器前进、后退会保留各自的来源与排序状态。

主列表和面包屑列使用相同名称顺序。更新时间相同时，名称作为后续排序依据。

RSS 与站点收录设置见[站点发现](/zh/p/discovery/#rss-订阅)；根导航入口见[页面区域与导航](/zh/p/layout-slots/)。
