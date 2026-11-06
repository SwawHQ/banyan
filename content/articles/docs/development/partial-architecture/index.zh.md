---
title: 布局与 partial 架构
url: p/partial-architecture/
description: 说明页面入口、功能模板与系统机制的所有权和依赖方向。
---

Banyan 使用 Hugo 0.146 之后的模板目录结构。主题要求 Hugo 0.168.0 或更高版本：页面入口直接放在 `layouts/`，可复用模板放在 `layouts/_partials/`，短代码放在 `layouts/_shortcodes/`，Markdown render hooks 放在 `layouts/_markup/`。不再保留 `_default/`、`partials/`、`shortcodes/` 的旧兼容目录。

## 页面入口

`layouts/` 根目录只有 Hugo 自动选择的入口和 front matter 显式选择的页面布局：

```text
layouts/
├─ baseof.html
├─ page-home.html
├─ page-article-rss.html
├─ page-article-norss.html
├─ page-collection-directory-name-only.html
├─ page-collection-directory.html
├─ page-collection-directory-all.html
├─ page-collection-products.html
├─ page-collection-products-all.html
├─ page-collection-language.html
├─ page-collection-appearance.html
├─ page-my.html
├─ page-offline.html
├─ home.llms.txt
├─ rss.xml
├─ robots.txt
├─ sitemap.xml
├─ 404.html
├─ _markup/
├─ _partials/
└─ _shortcodes/
```

内容通过 `layout: page-article-rss`、`layout: page-collection-directory-name-only` 等名称选择入口。`page-*` 是本项目为自定义 layout 采用的命名前缀，不表示 Hugo 的 `page` Kind；集合布局只用于 `_index.md` 声明的普通 section。入口负责装配，不重新实现集合、导航、文章或发布算法。只有入口确实拥有私有 helper 时才建立 `entry-*` partial 目录；不能为了目录对称增加单行转发层。

主题不拦截原生 taxonomy 配置；目前未提供 taxonomy 和 term 的列表布局。

当前只有两个入口私有目录：

- `entry-baseof/`：全站骨架独有的内联脚本和内容图标声明审计。`entry-baseof/audit-content-icons.html` 依赖入口对可列出页面的精确判断，不属于通用构建审计。
- `entry-page-home/`：宿主首页的艺术包与资源装配；`wind/model.html` 为风场短代码生成信号条目和场景样式。站点艺术包维护内容、CSS 和 JS。

## Partial 所有权

`layouts/_partials/` 使用两个开放家族。`feature-*` 表示用户能够识别的站点能力；`system-*` 表示实现这些能力所需的技术机制。未来出现账号、搜索、收藏等真实能力时，可以增加新的 `feature-*`，不把它们塞进既有目录。

```text
_partials/
├─ entry-baseof/
├─ entry-page-home/
│
├─ feature-browse/
├─ feature-document/
├─ feature-preferences/
├─ feature-updates/
│
├─ system-ui/
├─ system-assets/
├─ system-metadata/
├─ system-delivery/
└─ system-build/
```

- `feature-browse/`：集合成员、统一 row、排序、第一列入口、路径列、浏览来源、目录引用、URL 状态和集合内部的产品展示适配。
- `feature-document/`：正文外壳、标题契约、辅助列的元信息与章节目录、文章 schema、正文样式和 Markdown 图片渲染。
- `feature-preferences/`：语言上下文、语言选项模型，以及语言页与外观页共用的返回操作。外观固定为 auto、light、dark 三项，由 `feature-preferences/render.html` 提供；它不负责账号、会话或权限。
- `feature-updates/`：更新状态文案；`site-update` 短代码输出状态与原生按钮，浏览器控制器只读取页面数据。
- `system-ui/`：公共列表、完整条目、图标、原生控件、链接、页面 slot 与公共页面样式装配。
- `system-assets/`：Hugo Pipes、CSS/JS 构建、页面及全局资源发布、图片处理原语。
- `system-metadata/`：站点元信息、SEO、分享图和 agent/llms 输出。
- `system-delivery/`：Service Worker、prefetch、缓存策略及部署平台投影。
- `system-build/`：构建版本和时间。属于 `baseof.html` 入口契约的内容图标审计留在 `entry-baseof/`。

`feature-browse/directory/`、`feature-browse/collection/`、`feature-browse/navigation/` 等目录按一个功能内部的稳定子领域组织。家族前缀只表达所有权，不算一层算法包装；功能内部最多再使用两层确有意义的子领域。

`collection` 保留为成员、配置、来源和排序的领域名称。公共列表与条目使用 `list-*`、`item-*`，页面列使用 `page-column`；DOM 与 CSS 归属见 [UI 命名与职责](/zh/p/ui-naming/)。

Partial 内部调用同目录文件时使用 `./文件名`；入口模板和跨目录调用使用完整 partial 路径。
校验失败后用 `errorf` 报错，再用 `return` 结束当前模板，减少后续处理的条件嵌套。

## 依赖方向

```text
Hugo entry  ──→ entry-* / feature-* / system-*
entry-*     ──→ feature-* / system-*
feature-*   ──→ system-*
feature-*   ──→ 少量明确、单向的其他 feature-*
system-*    ──X feature-*
```

当前唯一的跨功能依赖是 `feature-document → feature-browse`：文章元信息读取目录反向引用和路径模型。它表达真实领域关系，保持单向即可。不要为了让依赖图看起来分层而把目录归属降成通用工具。

`system-*` 不得反向取得 Feature 状态。具体规则如下：

- `baseof.html` 取得浏览来源并输出页面数据；内联脚本只处理首帧状态，prefetch 和 Service Worker 从交付配置取得各自的数据，不读取浏览功能模型。
- `system-assets/script.html` 只处理调用者指定的资源和显式构建参数，不自行读取浏览路由。
- `system-metadata/seo/breadcrumb.html` 只消费入口传入的路径模型，不自行构建导航。
- `site-update` 短代码读取当前语言页面文案和交付配置；`"version"` 输出构建版本，`"status"`、`"content"` 分别装配程序和内容状态。

目录表达“谁拥有这段代码、它为什么变化”；调用图表达“谁依赖谁”。不要根据偶然的调用顺序创造 `site → explorer → ui → assets` 之类伪层级，也不要建立 `common`、`utils`、`platform`、`runtime` 等没有明确收口条件的目录。

## 功能内部边界

以下边界仍然成立：

1. 普通 section 列出直接成员，汇总入口读取目录的递归成员。
2. 结构路径用于静态 HTML 和 SEO；用户进入来源可由 `from` 改变，不能作为 canonical 事实。
3. 结构路径的 `nodes[].owner` 使用 Hugo Page，只在构建期读取；共享片段和浏览器列索引与结构路径分开生成。
4. collection source 是构建期描述；浏览器索引只保存所需逻辑路径和共享 HTML 片段哈希。
5. Markdown 响应式图片与社交分享图具有不同尺寸和继承规则，但共用底层资源处理原语。
6. 第一列、路径列和主列表共用完整列表与行组件，各功能保留成员发现规则。
7. 更新面板是用户功能；Service Worker、缓存和预取是 delivery 机制。

`feature-browse/directory/index.html` 每种语言建立一次目录成员索引，返回：

- `direct`：栏目中的真实文章和已解析引用。
- `recursive`：栏目子树的正文集合，同一 Page 只计一次。
- `incoming`：原文对应的额外引用栏目，不包含真实父目录。

索引同时返回已发现的 `sections`，来源注册复用这份目录集合。
`directory/members.html` 为普通目录提供直接与递归文章，统一筛选索引外的回退候选。
`collection/articles.html` 解析汇总目标；汇总 HTML 与栏目 RSS 共用它。
`feature-browse/is-rendered-html.html` 统一 HTML 输出、渲染状态及占位译文判断。

`_map.toml` 是栏目资源，按内容路径解析当前语言的真实 Page。
行模型、目录计数、汇总入口、文章元信息和 `rss.xml` 共用该索引，不重复扫描 Markdown。
引用不生成页面，不改变 Parent 或正文网址。
`sitemap.xml` 和 `home.llms.txt` 共用实际渲染页面的收录集合，不为引用生成条目。

SSR 列表使用以下分工：

| 模板 | 职责 |
| --- | --- |
| `system-ui/list/render.html`、`item.html` | 输出列表、表头外层和完整条目；条目包含名称控件及已生成的字段 HTML |
| `system-ui/list/item-link.html`、`item-button.html`、`item-content.html` | 输出链接或按钮，以及共用的图标和文字 |
| `feature-browse/navigation/root/model.html`、`root/render.html` | 模型取得结构根页面并生成可见入口；渲染器装配 `nav` 与公共列表 |
| `feature-browse/navigation/path/columns.html`、`source/fallback-model.html` | 从结构 owner 取得集合列模型或不可排序的后备列 |
| `feature-browse/navigation/source/fragment.html`、`publish.html` | 生成并发布路径列头、行、图标及排序字段的共享 HTML 片段 |
| `feature-browse/collection/render.html`、`item-fields.html`、`sort/header.html` | 保留配置、领域 row、来源链接、排序属性与 schema；生成字段和表头 HTML 供公共列表装配 |
| `system-ui/choice/render.html`、`_shortcodes/site-update.html` | 分别生成选择列表与更新状态及检查按钮 |

功能模板先生成字段 HTML，再通过 `fields` 传给完整条目。公共模板只装配 HTML，不读取集合配置或调用功能模板。公共列表接收 `title` 时保留选择页的 `h1`，接收 `header` 时为已生成的字段头添加外层行。浏览器动态路径列克隆共享片段的 DOM。

`feature-browse/navigation/source/models.html` 复用目录索引生成 `columns_by_href`，列模型包含 config、rows、source 和 `payloadUrl`。`source/publish.html` 发布共享 HTML，`source/pack.html` 输出本页所需的列索引。主列表、导航片段和正文路径读取同一份集合成员。结构模型与浏览器索引的边界见 [路径模型](/zh/p/breadcrumb-models/#路径模型)。

页面 bundle 资源的定位与发布是两个动作：`system-assets/resolve-page.html` 只返回源 resource 和目标目录，`system-assets/publish-page.html` 才发布源文件。分享图先解析源 resource；可处理的位图只发布最终 `1200x630` JPG，非位图才发布原资源，避免为了生成衍生图而附带发布未引用的源图。

## 新增与修改规则

- 调用者知道意图时，直接调用具名 partial；不增加 `mode`、`type`、`op` 字符串分发器。
- partial 调用写完整 `.html`、`.json` 或 `.txt` 路径。
- 单行转发只有代表稳定契约或 Hugo 必需入口时才保留；迁移完成后不保留旧路径兼容壳。
- 数据 partial 返回模型；输出 HTML 的 partial 使用 `render`、`panel`、`column`、`cell` 等名字表达副作用。
- 修改成员发现或 row 字段时，同时验证主列表、导航片段、列索引、排序和进入来源恢复。
- 新 Feature 先留在唯一入口附近；出现多个协作模块或跨入口复用后再提取，避免预建空目录。

`baseof.html` 是最终 composition root。它可以显式组合功能和系统模块，但复杂算法必须留在所属模块中。
