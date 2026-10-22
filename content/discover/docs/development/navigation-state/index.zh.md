---
title: 导航状态协议
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
   - 当前页面把可进入来源的当前层与祖先层 collection payload 内嵌一次
3. 运行时状态层
   - 当前从哪条路径进入：`from`
   - 当前 collection 的排序：`sort`
   - 当前路径上每层冻结排序：`sorts`

不要把这 3 层混在一起。

## URL 状态

`from`、`sort`、`sorts` 是前端视图状态，统一放在 URL 的 `#` 后：

```txt
/discover/products/example/#from=discover/products&sort=name-asc&sorts=_,date-desc&anchor=installation
```

字段名是代码协议，不再通过 `navigation-state-default.toml` 配置。
读取和写入共用 `navigation-state.contract.js`。真实查询参数仍保留在 `?` 后。
前端不读取旧查询参数中的导航状态，也不自动迁移旧地址。

`anchor` 表示正文目标元素的 ID。没有其他状态时，仍使用原生 `#installation`。
带导航状态的章节链接使用 `&anchor=installation`；JS 负责定位，同时保留来源和排序。
滚动正文只更新目录高亮，不改写 URL。

同页片段导航通过 `hashchange` 更新来源列、根入口、排序和章节位置。
排序控件继续使用 `history.replaceState()`，并主动刷新受影响的列；
该接口不会触发 `hashchange`，也不会增加历史记录。

片段不进入 HTTP 请求，HTTP 和 SW 缓存不需要再忽略这些参数。
真实查询参数仍属于缓存地址。章节和导航状态由每个标签页的 URL 保存。

### `from`

`from` 表示 entry 页是沿哪条 collection 路径进入的。

例子：

```txt
#from=tools/free
```

含义：

- 当前页是 `example-tool`
- 它是从 `/tools/free/` 分类点进去的

`from` 只表达来源 collection lineage，不表达当前 entry，也不表达排序。
当前 entry 由页面路径表达，例如 `/discover/example-tool/`。因此
`from=discover/example-tool` 不是有效的来源集合。

只有当前页面发布的来源集合才是有效 `from`。不能根据一个任意字符串的
前缀推断来源；不存在或不属于当前页面的来源使用内容祖先的默认选中项。
第一列始终保留完整根页面列表，`from` 仅调整选中状态和后续路径列。

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

### `sort`

`sort` 表示当前页面的活动 collection 排序。

例子：

```txt
#sort=name-asc
```

它只服务当前页主列表与列头控件，也会同步投影到从该主列表离开的导航链接上。
breadcrumb 分栏不读取或改写 `sort`。

### `sorts`

`sorts` 表示当前进入路径上，每一层 collection 的冻结排序。

例子：

```txt
#from=discover/products&sorts=name-asc,date-desc
```

含义：

- `/discover/` 这一层按 `name-asc`
- `/discover/products/` 这一层按 `date-desc`

注意：

- `sorts` 按路径层级位置对齐
- 它不是全站排序
- 它只对当前 `from` lineage 有意义
- breadcrumb 分栏排序只改写自己对应的 slot；不会联动主列表 `sort`
- 当路径上的排序都等于对应 collection 的默认排序时，URL 应省略
  `sorts`；只有出现非默认排序时才写入完整 lineage，必要时用 `_`
  保持层级占位。

## 内嵌 collection payload

每个页面的 `data-entry-breadcrumb-sources` 只包含该页面实际可进入的来源。浏览器来源使用以下字段：

| 字段 | 用途 |
| --- | --- |
| `logicalPath`、`rootItem` | 来源地址与第一列选中项 |
| `columns: [{selected, source, payload}]` | 祖先集合列；selected 是纯路径项，payload 是紧凑 row 数据 |
| `currentColumn: {source, payload}` | 来源集合的当前列 |

两处 payload 使用同一种紧凑 row 协议。有效集合列不重复输出 items；非集合 owner 使用静态形式 `{selected, source: {href, label}, items}`。不再生成或请求 `_items.json`／`_children.json`。

`browse/entry-source.js` 读取来源 metadata 并选择有效来源，不解码 row；第一列根导航只依赖这层读取。`browse/breadcrumb-source.js` 负责 row 解码与读取缓存。两种读取各自缓存原始属性对应的结果，属性不变时重复刷新不再解析。集合 source index 从已解码的 sources 生成，并随同一份结果复用。

不同 `js.Build` bundle 各自保存模块缓存。内联首帧骨架也有自己的 metadata 读取；缓存不跨 bundle 共享，因此不保证整页全局只解析或解码一次。

生产检查将单页解码后的 `data-entry-breadcrumb-sources` 限制为 64 KiB。这个上限约束每页实际携带的来源、层级与 row 总量；集合页自身的 HTML 预算则按“固定外壳 + 每条 row”计算，正常新增内容不会因为固定总量阈值而误报。

它承担：

- 当前 collection 的 item rows
- provider
- logical path
- sort variant
- default sort

它不承担：

- 多层排序状态
- 页面列的显示或隐藏状态
- 页面画幅的滚动位置

也就是说：

- Hugo collection model 是构建期事实源，browser source 是当前页面需要的可序列化投影
- `from/sort/sorts` 是“当前页面运行时状态”

## 路径项目与列来源

结构路径的每个节点保存 `{item, owner}`。owner 是构建期的 Hugo Page，没有所属页面时为空；呈现列和浏览器来源分别生成，不把 Page 序列化。

| 字段 | 地址含义 |
| --- | --- |
| `item.href` | 路径项自身的目标 |
| `column.source.logicalPath` | 该列兄弟条目的集合路径 |

例如 Products 的 `item.href` 是 `/discover/products/`，所在列的兄弟条目来自 `/discover/`。

SSR 和浏览器绘制都接收 `{source, items}` 呈现列。items 按 source 生成，不能仅从当前项目的链接反推整列来源。collection source 使用 `logicalPath`、`sortVariant`、`defaultSort`；config 和领域 row 保留内部 snake_case 字段。

## 当前主路径

当前已统一成：

1. 真实根页面列表提供第一列；结构路径只保存 `schema_items`、`root_item` 和 `nodes: [{item, owner}]`
2. Hugo 从结构节点生成 SSR `columns: [{source, items}]`，并输出独立的浏览器来源 columns 与 currentColumn
3. runtime 读取缓存的来源，结合 `from/sort/sorts` 从已解码 payload 生成 `{source, items}` 呈现列；解码边界见 [内嵌 collection payload](#内嵌-collection-payload)

entry 页与 collection 页虽然仍有不同的 orchestration，但它们共享：

- items payload 解码
- sort token 解释
- row -> href 生成
- breadcrumb column item 组装

## 布局边界

当前所有宽度共用横向画幅，布局调整继续沿用以下边界：

- 页面内嵌 payload 是本页路径列唯一的浏览器数据输入
- `from/sorts` 仍是当前页面路径状态
- slots 不负责承载 browser 状态

路径列只有一种呈现方式，不再按宽度或 `variant` 选择不同菜单。`{source, items}` 的呈现协议贯穿 Hugo 静态输出和浏览器同步绘制；没有并行的 preview／fragment 重绘，也没有保留旧 `menu` 字段兼容读取。预取使用主图标和列范围生成的共享选择器，根导航使用 `root` 范围；链接不输出预取属性。预取规则见 [prefetch-stacks.md](/zh/p/prefetch-stacks/)。
