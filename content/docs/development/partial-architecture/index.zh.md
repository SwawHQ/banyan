---
title: 布局与 partial 架构
slug: partial-architecture
description: 说明页面入口、功能模板与系统机制的所有权和依赖方向。
---

Banyan 使用 Hugo 0.146 之后的模板目录结构。主题要求 Hugo 0.157.0 或更高版本：页面入口直接放在 `layouts/`，可复用模板放在 `layouts/_partials/`，短代码放在 `layouts/_shortcodes/`，Markdown render hooks 放在 `layouts/_markup/`。不再保留 `_default/`、`partials/`、`shortcodes/` 的旧兼容目录。

## 页面入口

`layouts/` 根目录只有 Hugo 自动选择的入口和 front matter 显式选择的页面布局：

```text
layouts/
├─ baseof.html
├─ page-home.html
├─ page-article.html
├─ page-collection.html
├─ page-language.html
├─ page-appearance.html
├─ page-my.html
├─ page-offline.html
├─ page-prefetch-debug.html
├─ page-powered-by.html
├─ home.llms.txt
├─ robots.txt
├─ sitemap.xml
├─ 404.html
├─ _markup/
├─ _partials/
└─ _shortcodes/
```

内容通过 `layout: page-article`、`layout: page-collection` 等名称选择入口。`page-*` 是本项目为自定义 layout 采用的命名前缀，不表示 Hugo 的 `page` Kind；例如 `page-collection` 同时供 section、taxonomy 和其他需要集合呈现的页面使用。入口负责装配，不重新实现集合、导航、文章或发布算法。只有入口确实拥有私有 helper 时才建立 `entry-*` partial 目录；不能为了目录对称增加单行转发层。

当前只有三个入口私有目录：

- `entry-baseof/`：全站骨架独有的内联脚本和内容图标声明审计。`entry-baseof/audit-content-icons.html` 依赖入口对可列出页面的精确判断，不属于通用构建审计。
- `entry-page-home/`：首页场景模型，返回信号条目与 `sceneCSS`；`page-home.html` 装配样式、交互与 `assets/page-home/windsock.svg`。
- `entry-page-prefetch-debug/`：prefetch 调试页的可见内容。

## Partial 所有权

`layouts/_partials/` 使用两个开放家族。`feature-*` 表示用户能够识别的站点能力；`system-*` 表示实现这些能力所需的技术机制。未来出现账号、搜索、收藏等真实能力时，可以增加新的 `feature-*`，不把它们塞进既有目录。

```text
_partials/
├─ entry-baseof/
├─ entry-page-home/
├─ entry-page-prefetch-debug/
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

- `feature-browse/`：集合成员、统一 row、排序、第一列入口、路径列、浏览来源、taxonomy、URL 状态和集合内部的产品展示适配。
- `feature-document/`：正文外壳、标题契约、辅助列的元信息与章节目录、文章 schema、正文样式和 Markdown 图片渲染。
- `feature-preferences/`：语言上下文、语言选项模型，以及语言页与外观页共用的返回操作。外观固定为 auto、light、dark 三项，由 `page-appearance.html` 就地装配，不单独建立选项模型；它不负责账号、会话或权限。
- `feature-updates/`：检查更新页面及其静态状态文案；浏览器控制器只读取页面已输出的数据。
- `system-ui/`：公共列表、完整条目、图标、原生控件、链接、页面 slot 与公共页面样式装配。
- `system-assets/`：Hugo Pipes、CSS/JS 构建、页面及全局资源发布、图片处理原语。
- `system-metadata/`：站点元信息、SEO、分享图和 agent/llms 输出。
- `system-delivery/`：Service Worker、prefetch、缓存策略及部署平台投影。
- `system-build/`：构建版本、时间和跨入口构建审计。只属于 `baseof.html` 入口契约的内容图标审计留在 `entry-baseof/`。

`feature-browse/collection/`、`feature-browse/navigation/`、`feature-browse/taxonomy/` 等目录仍按一个功能内部的稳定子领域组织。家族前缀只表达所有权，不算一层算法包装；功能内部最多再使用两层确有意义的子领域。

`collection` 保留为成员、配置、来源和排序的领域名称。公共列表与条目使用 `list-*`、`item-*`，页面列使用 `page-column`；DOM 与 CSS 归属见 [UI 命名与职责](/zh/docs/development/ui-naming/)。

## 依赖方向

```text
Hugo entry  ──→ entry-* / feature-* / system-*
entry-*     ──→ feature-* / system-*
feature-*   ──→ system-*
feature-*   ──→ 少量明确、单向的其他 feature-*
system-*    ──X feature-*
```

当前唯一的跨功能依赖是 `feature-document → feature-browse`：文章元信息读取 taxonomy 的配置、值和 URL。它表达真实领域关系，保持单向即可。不要为了让依赖图看起来分层而把 taxonomy 降成通用工具。

`system-*` 不得反向取得 Feature 状态。具体规则如下：

- `baseof.html` 取得浏览端 JS 构建参数，再显式传给内联脚本、prefetch runtime 和 Service Worker。
- `system-assets/script.html` 只消费调用者传入的可选 `params`，不自行读取浏览路由。
- `system-metadata/seo/breadcrumb.html` 只消费入口传入的路径模型，不自行构建导航。
- `feature-updates/panel.html` 直接取得构建版本／时间与当前语言页面文案，不经过全站 runtime manifest。

目录表达“谁拥有这段代码、它为什么变化”；调用图表达“谁依赖谁”。不要根据偶然的调用顺序创造 `site → explorer → ui → assets` 之类伪层级，也不要建立 `common`、`utils`、`platform`、`runtime` 等没有明确收口条件的目录。

## 功能内部边界

以下边界仍然成立：

1. 普通 section 与 taxonomy 都能产出 row，但成员发现规则不同。
2. 结构路径用于静态 HTML 和 SEO；用户进入来源可由 `from` 改变，不能作为 canonical 事实。
3. 结构路径的 `nodes[].owner` 使用 Hugo Page，只在构建期读取；SSR 列和浏览器投影与结构路径分开生成。
4. collection source 是小型描述；浏览器投影用 `columns` 和 `currentColumn` 保存祖先层与当前层的紧凑行载荷。
5. Markdown 响应式图片与社交分享图具有不同尺寸和继承规则，但共用底层资源处理原语。
6. 第一列、路径列和主列表共用完整列表与行组件，各功能保留成员发现规则。
7. 更新面板是用户功能；Service Worker、缓存和预取是 delivery 机制。

SSR 列表使用以下分工：

| 模板 | 职责 |
| --- | --- |
| `system-ui/list/render.html`、`item.html` | 输出列表、表头外层和完整条目；条目包含名称控件及已生成的字段 HTML |
| `system-ui/list/item-link.html`、`item-button.html`、`item-content.html` | 输出链接或按钮，以及共用的图标和文字 |
| `feature-browse/navigation/root/model.html`、`root/render.html` | 模型取得结构根页面并生成可见入口；渲染器装配 `nav` 与公共列表 |
| `feature-browse/navigation/path/columns.html`、`fallback-column.html` | 将结构节点转换为 `{source, items}` 呈现列；非集合 owner 保留静态列 |
| `feature-browse/navigation/path/column.html`、`column-header.html` | 接收呈现列，保留滚动容器与 `from`；生成名称字段头和名称行供公共列表装配 |
| `feature-browse/collection/render.html`、`item-fields.html`、`sort/header.html` | 保留配置、领域 row、来源链接、排序属性与 schema；生成字段和表头 HTML 供公共列表装配 |
| `system-ui/choice/render.html`、`feature-updates/panel.html` | 生成选择项或更新操作；共用公共列表和按钮 |

功能模板先生成字段 HTML，再通过 `fields` 传给完整条目。公共模板只装配 HTML，不读取集合配置或调用功能模板。公共列表接收 `title` 时保留选择页的 `h1`，接收 `header` 时为已生成的字段头添加外层行。浏览器动态路径列保留现有 DOM 绘制逻辑。

`feature-browse/navigation/source/models.html` 按集合地址生成 `columns_by_href`，复用列入 `Site.Pages` 的集合的 config、rows、source 和 compact payload。主列表、SSR 路径列与浏览器投影读取这份构建数据。`build.list: local` 或 `build.list: never` 的合法集合页可独立渲染；registry 缺少该页时，`collection/render.html` 直接构建本页 config、rows 和 source，`source/context.html` 直接构建本页 source。collection source 使用 `logicalPath`、`sortVariant`、`defaultSort`，config 与领域 row 保留内部 snake_case 字段。结构模型、呈现列和浏览器来源的完整字段见 [路径模型](/zh/docs/development/breadcrumb-models/#路径模型)。

页面 bundle 资源的定位与发布是两个动作：`system-assets/resolve-page.html` 只返回源 resource 和目标目录，`system-assets/publish-page.html` 才发布源文件。分享图先解析源 resource；可处理的位图只发布最终 `1200x630` JPG，非位图才发布原资源，避免为了生成衍生图而附带发布未引用的源图。

## 新增与修改规则

- 调用者知道意图时，直接调用具名 partial；不增加 `mode`、`type`、`op` 字符串分发器。
- partial 调用写完整 `.html`、`.json` 或 `.txt` 路径。
- 单行转发只有代表稳定契约或 Hugo 必需入口时才保留；迁移完成后不保留旧路径兼容壳。
- 数据 partial 返回模型；输出 HTML 的 partial 使用 `render`、`panel`、`column`、`cell` 等名字表达副作用。
- 修改成员发现或 row 字段时，同时验证主列表、路径列、页面内嵌 payload、排序和进入来源恢复。
- 新 Feature 先留在唯一入口附近；出现多个协作模块或跨入口复用后再提取，避免预建空目录。

`baseof.html` 是最终 composition root。它可以显式组合功能和系统模块，但复杂算法必须留在所属模块中。
