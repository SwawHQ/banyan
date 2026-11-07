---
title: 导航状态协议
date: 2026-11-06
lastmod: 2026-11-07
url: p/navigation-state/
description: 说明来源、排序、章节与浏览器历史之间的边界。
---

## 目的

这份文档只说明一件事：

- 当前 breadcrumb / collection browser 相关状态，应该如何理解
- 哪些是页面语义
- 哪些是运行时视图状态
- 哪些是构建期产物

它不是产品说明，而是后续维护时的“协议与边界备忘录”。

## 核心判断

当前导航体系分成 3 层：

1. 页面语义层
   - 当前页面在真实内容结构中属于哪个根入口
   - breadcrumb 各层分别对应哪个 collection
2. 页面数据层
   - 当前页面发布可进入来源的列索引，列内容使用共享 HTML 片段
3. 运行时状态层
   - 当前从哪条路径进入：`from`
   - 当前路径上各 collection 的排序，包括主列表：`sorts`

不要把这 3 层混在一起。

## URL 状态

`from`、`sorts` 是前端视图状态，统一放在 URL 的 `#` 后：

```txt
/p/example-product/#from=products/examples&sorts=_,name-desc&anchor=installation
```

字段名是代码协议，不再通过 `navigation-state-default.toml` 配置。
读取和写入共用 `navigation-state.contract.js`。真实查询参数仍保留在 `?` 后。
前端不读取旧查询参数中的导航状态，也不读取或迁移独立的 `sort` 字段。

`anchor` 表示正文目标元素的 ID。没有其他状态时，仍使用原生 `#installation`。
带导航状态的章节链接使用 `&anchor=installation`；JS 负责定位，同时保留来源和排序。
滚动正文只更新目录高亮，不改写 URL。

同页片段导航通过 `hashchange` 更新来源列、根入口、排序和章节位置。
排序控件继续使用 `history.replaceState()`，并主动刷新受影响的列；
该接口不会触发 `hashchange`，也不会增加历史记录。

片段不进入 HTTP 请求，HTTP 和 SW 缓存不需要再忽略这些参数。
真实查询参数仍属于缓存地址。章节和导航状态由每个标签页的 URL 保存。

### `from`

`from` 表示文章页是沿哪条 collection 路径进入的。来源与文章的默认归属不同时，文章链接保留此参数。

例子：

```txt
#from=products/examples
```

含义：

- 当前页是 `example-product`
- 它是从 `/products/examples/` 目录点进去的

`from` 只表达来源 collection lineage，不表达当前 entry，也不表达排序。
当前 entry 由页面路径表达，例如 `/p/example-product/`。因此
`from=articles/category1/example` 不是有效的来源集合。

有效 `from` 必须在本页列索引中，且对应共享片段包含当前文章。不能根据任意字符串的前缀推断来源；不存在或不包含当前文章的来源使用内容祖先的默认选中项。
第一列始终保留完整根页面列表，`from` 仅调整选中状态和后续路径列。

分类和聚合列表页由页面自身确定完整导航路径，不生成冗余的 `from`。列表页忽略并移除 `from`，保留查询参数、排序和锚点。例如
`/zh/pr/paid/#sorts=date-asc,_` 表示 `/pr/` 按时间升序，`/pr/paid/` 主列表使用该栏目的默认排序。

### 系统页面与返回

语言、外观、我的、更新使用普通页面链接，不携带 `return`，也不另行存储原阅读地址。
语言切换留在对应语言的设置页；系统页面始终选中自身入口。

`assets/js/preferences/back-links.js` 为 `data-page-action="back"` 提供原生历史后退行为，只随使用返回控件的页面加载。
“返回”每次后退一条记录；连续访问多个设置页时也逐页返回。
语言页内切换语言使用 `location.replace()`，替换当前设置页的历史记录。
例如“文章 → 中文语言页 → 英文语言页 → 中文语言页”只保留“文章 → 中文语言页”，
返回按钮与浏览器后退均一次回到进入语言设置前的页面，不逐个经过语言选择。
新标签页没有上一条记录时，使用链接自身的 `href` 回到当前语言首页。
文章的路径、`from`、排序和锚点仍属于其自身历史记录，不再复制到系统页面。

在语言页明确选择语言后，页内 `preferences/language-page.js` 用当前标签页的
`sessionStorage["banyan:language-return"]` 只记录语言代码字符串（例如 `zh`），保持缓存中旧页面的读取约定。
显示名称单独放在 `banyan:language-return-label` 的 `{code, name}` 中，仅当其代码与本次选择一致时使用。
附加名称缺失或无法读取不影响返回；没有匹配名称时，缺少译文的提示使用语言代码。
全站 `assets/js/preferences/language-return.js` 在首个非语言页恢复时
立即消费代码与附加名称：历史恢复（含 `pageshow.persisted` 的 BFCache 恢复）使用本页
Hugo 已输出的 `link[rel="alternate"][hreflang]` 打开所选语言版本，普通导航只清除记录并尊重链接本身的语言。
译文跳转使用 `location.replace()`，保留查询参数与锚点，不增加历史记录；
目标页继续按既有协议校验来源和排序。没有译文时保留原内容并显示说明。
不同语言的段落及锚点可能不同，不保证正文滚动位置逐像素一致。

这条一次性记录不保存网址，也不使用全局语言偏好强制改写页面；移除自动语言推荐后，`preferred_lang` 不再读写：
没有本次选择时，打开英文书签、原生后退和其他标签页保持原本地址。
会话存储不可用时，语言链接和原生返回仍然可用，但无法跨页面传递这次返回语言。

页面不再定义或处理 `return`；旧网址中若残留此参数，与其他未知参数一样被忽略。没有 URL 清理兼容层，也不会把参数传播到语言选项。原阅读网址仍由浏览器历史保存。

语言选项、地址和选中状态由 Hugo 一次输出，浏览器仅处理用户点击。所有页面不再重复附带 `data-language-context`；返回说明保留为一个本地化文本属性。SEO 翻译链接以发布域名输出，返回时核对其与 canonical 同源，再使用路径在当前服务域名下打开，确保本地预览也正常。

### `sorts`

`sorts` 按当前有效路径的层级记录每一列 collection 的排序，包含主列表。

例子：

```txt
/zh/articles/#sorts=name-desc
/zh/articles/docs/#sorts=date-asc,name-desc
/p/example-product/#from=products/examples&sorts=_,name-desc
```

单级列表只有一项。两级列表中，第一项对应 `/articles/` 路径列，第二项对应 `/articles/docs/` 主列表。文章页按有效来源路径读取各项，文章本身不增加一项。

注意：

- `sorts` 按集合逻辑路径从根级依次排列；语言前缀和第一列根导航不占位置
- 读取短数组时从根级对齐，缺失的尾项按各列自己的默认排序处理
- 它不是全站排序
- 它对应当前有效导航路径：文章页使用有效 `from` 或默认内容路径，分类和聚合列表页使用自身路径
- 每列排序只改写自己对应的一项，保留其他列的排序
- `_` 表示该列自己的默认排序；父子栏目的默认排序可以不同
- 全部槽位为 `_` 时省略 `sorts`；否则写出完整层级，不裁掉末尾占位

写入某列排序时，所选排序等于该列默认值才归一化为 `_`。进入子栏目时可以显式携带继承的父级排序值；子栏目的默认值未知时不作默认归一化，也不自动清理显式排序值。

主列表排序后同步更新路径列的原生链接。普通点击与新标签打开使用相同的最新排序；排序不增加历史记录，也不触发正文锚点重定位。

## 内嵌 collection payload

页面只在 `body[data-navigation]` 内嵌列索引，不内嵌行数据。内容保存在带指纹的共享 `.txt` HTML 片段中。

| 字段 | 用途 |
| --- | --- |
| `home` | 当前语言首页路径 |
| `resources` | 导航片段资源目录 |
| `columns` | 逻辑路径到片段 SHA-256 的映射 |
| `default` | 真实内容路径对应的默认尾列 |
| `error` | 当前语言的加载失败说明 |

浏览器从 `resources`、哈希和 `.txt` 后缀取得同源片段。片段包含列头、图标、原生链接和 `data-sort-*`；内容按栏目默认顺序输出，同一栏目由多个页面共用。根导航、栏目主列表和正文继续保留在页面 HTML。

`browse/entry-source.js` 读取并缓存索引，按 `from` 和 `default` 选择根入口及路径。`browse/breadcrumb-source.js` 加载片段，校验列路径、节点、链接与排序字段，缓存已加载列并合并同一资源的并发请求。下载的内容先保存在 template 中，再克隆到真实路径列。

初始骨架先按索引预留列宽，加载成功后填充已有滚动容器。加载失败时显示本地化说明。来源片段不包含当前文章时，运行时清除无效 `from` 并回到真实内容路径。

URL 中的 `from/sorts` 保存本次浏览状态；共享片段只提供列内容和默认排序，不保存滚动位置或用户状态。生产检查分别核对索引、片段文件和页面 HTML 的体积。

## 路径项目与列来源

结构路径的每个节点保存 `{item, owner}`。owner 是构建期的 Hugo Page，不进入浏览器索引。

| 字段 | 地址含义 |
| --- | --- |
| `item.href` | 路径项自身的目标 |
| `column.source.logicalPath` | 该列兄弟条目的集合逻辑路径 |
| `column.payloadUrl` | 已发布的共享 HTML 片段 |

例如 Products 的 `item.href` 是 `/d/products/`，所在列的兄弟条目来自 `/d/`。构建时由 owner 取得列模型并发布片段；运行时用索引选择这些列，不从某个条目的链接猜测整列内容。

## 当前主路径

1. 真实根页面生成第一列；结构路径保存 `schema_items`、`root_item` 和 `nodes: [{item, owner}]`。
2. Hugo 生成共享导航 HTML，并把本页所需的逻辑路径和资源哈希写入 `data-navigation`。
3. 骨架脚本预留容器；浏览器加载片段，按 `from/sorts` 克隆、排序和选中节点。

文章页与集合页共用片段读取、排序规则和链接生成。主列表排序仍移动本页已有 HTML 行；路径列排序移动已加载的片段行。读取边界见 [内嵌 collection payload](#内嵌-collection-payload)。

## 布局边界

各宽度共用横向画幅，布局继续遵守以下边界：

- 列索引与共享 HTML 是路径列的数据输入。
- `from/sorts` 是当前网址的路径状态。
- `params.slots` 控制是否装配区域，不承载浏览状态。
- 根入口保留在原页面 HTML；来源变化只改变选中项。

路径列复用已有滚动容器，按需增减列；片段克隆后沿用公共列表 DOM。预取按主图标和列范围生成共享选择器，链接不另加预取属性。规则见 [prefetch-stacks.md](/zh/p/prefetch-stacks/)。
