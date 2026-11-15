---
title: 约定 · 导航状态协议
date: 2026-11-06
lastmod: 2026-11-14
url: p/navigation-state/
description: 说明浏览来源、排序、章节和历史记录的重要约定与源码入口。
---

内容归属由内容树决定，本次浏览状态由网址保存。发布网址不能用来推断内容归属。构建模型见[面包屑导航模型](/zh/p/breadcrumb-models/)，页面配置见[页面区域与布局](/zh/p/layout-slots/)。

## URL 状态

`from`、`sorts` 和 `anchor` 放在 URL 片段中，不进入 HTTP 或 SW 缓存地址。真实查询参数仍保留在 `?` 后。

```text
/p/example-product/#from=products/examples&sorts=_,name-desc&anchor=installation
```

### `from`

表示文章浏览来源，指向栏目内容路径，不指向文章。有效来源必须由页面索引提供，且对应栏目包含当前文章；无效来源回到文章默认归属。

来源只改变根入口选中项和面包屑列，不改变正文、规范地址或完整根入口列表。栏目与汇总列表使用自身路径，不保留冗余的 `from`。

### `sorts`

按当前有效内容路径从根级记录各栏目排序，包含主列表。根导航列、语言前缀和文章本身不占排序位置。

`_` 表示对应栏目的默认排序；缺少的尾项也使用各自默认值。生成链接时省略尾部默认项，保留中间占位。每列只更新自己的排序，不增加历史记录。普通点击和新标签打开须得到相同状态。

排序状态按栏目保存。栏目链接保留祖先状态，不将当前排序复制到子栏目；未指定状态的栏目读取自己的默认排序。

### 章节与历史

只有章节时使用原生 `#installation`；与导航状态并存时使用 `anchor=installation`。排序不触发章节重新定位，正文滚动不改写网址。历史恢复交给浏览器，不在导航协议中保存滚动位置。

### 系统页面与返回

语言、外观等页面使用普通链接，返回使用浏览器历史，不另存原阅读网址。无上一条历史时返回当前语言首页。

语言选择替换当前设置页历史。返回内容时，优先打开所选语言的真实译文；缺少译文时保留原内容并显示说明。这次选择只作用于当前标签页的一次返回，不成为全站语言偏好。会话存储不可用时，普通链接和返回仍可用。

## 源码入口

以下路径相对 `module/assets/js/`。

| 修改内容 | 入口 |
| --- | --- |
| 片段字段与章节读写 | `browse/navigation-state.contract.js` |
| 内容路径与排序位置 | `browse/navigation-state.js` |
| 选择有效来源 | `browse/navigation-source.js`、`breadcrumb-controller.js` |
| 链接生成与排序刷新 | `browse/breadcrumb-links.js`、`breadcrumb-sort.js`、`collection-sort.js` |
| 章节定位 | `document/anchors.js`、`document/toc.js` |
| 设置页返回与译文选择 | `pages/back.js`、`preferences/language-page.js`、`preferences/language-return.js` |

列索引与共享片段的构建入口见[面包屑模型](/zh/p/breadcrumb-models/#面包屑模型)。修改协议时，同时核对构建端、浏览器端及[导航检查](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。
