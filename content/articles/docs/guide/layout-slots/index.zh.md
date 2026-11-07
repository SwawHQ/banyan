---
title: 页面区域与布局
date: 2026-11-06
lastmod: 2026-11-07
url: p/layout-slots/
description: 配置根导航入口、路径区域和文章元信息。
---

## 当前约定

第一列入口由内容树生成，页面无需声明菜单归属。`params.slots` 只控制路径及文章辅助内容是否装配；框架负责布局。正文 `main` 是内建区域，不通过 front matter 指向 fragment。

`params.slots` 中的 `breadcrumb` 装配 shell 内的 `nav.slot.path-navigation[data-slot="breadcrumb"]`，其子节点是路径列。`data-slot="breadcrumb"` 保留区域语义；屏幕上 nav 使用 `display: contents`，各列直接参与 `.page-shell` 的横向 Grid。列尺寸和打印分组见 [公共页面列](/zh/p/ui-naming/#公共页面列)。

布局、路径列、集合与更新模块的命名见 [UI 命名与职责](/zh/p/ui-naming/)。内部 `slot_flags` 保存区域开关，不再表示片段来源。

## 第一列入口

当前语言的根页面集合包含首页自身及直接子页 `Home.Pages`；这份结构集合完整保留，用于路径归属。第一列默认显示其中已发布的 HTML 页面。名称取 `LinkTitle`／`Title`，网址取 `RelPermalink`，顺序取页面 `weight`。来源变化只更新选中项，不替换可见入口列表。

入口可在自己的 `params` 中用 `icon: folder` 声明 SVG，或用 `icon: { text: "©" }` 声明字符图标；省略时使用 `folder`，不存在的图标会让构建失败。当前语言、外观、我的入口分别声明 `language`、`theme`、`my`。

- 不能只取 `Home.Sections`，因为入口可以是栏目或普通页面。
- 不能只取 `Site.Pages`，因为 `build.list: local` 的系统页只列在其父页集合中。
- `build.list: never` 的内部节点不作为入口。
- `weight` 只需在入口本身定义，不应 cascade 到所有文章。

首页在 `content/_index*.md` 声明 `linkTitle`、`weight` 和 `params.icon`，使用普通条目组件，正文使用 `page-home`，通过 `home-art` 引用内部艺术包。`params.show_navigation` 控制首页是否显示第一列；站点自己的根页面决定入口和文案。

新增入口时建立真实根页面，并提供名称和顺序。内部节点可用 `build.list: never` 排除入口，无需额外的菜单开关。

第一列显示已发布的根页面，顺序使用页面 `weight`。

## 支持的 slots

页面 front matter 的 `params.slots` 是字符串数组。省略名称表示不装配该区域，`[]` 关闭全部区域。

| 名称 | 用途 |
| --- | --- |
| `breadcrumb` | 当前页面的集合路径及各级条目 |
| `meta` | 文章元信息、章节目录和正文页的 BlogPosting |

`meta` 统一控制文章元信息、章节目录和正文页的 BlogPosting。省略它会同时关闭这三部分，详见 [布局与章节定位](/zh/p/breadcrumb-models/#布局与维护边界)。`document-aside` 是布局 block，Markdown 内容不能将它声明为 slot。

未知 slot 名和错误值类型会使构建失败。当前只接受 `breadcrumb` 和 `meta`，不接受字典或布尔值。

页面基础样式由 `baseof.html` 直接调用 `system-ui/page-styles.html`，页面入口不能替换或漏掉它。CSS 归属与发布名见 [UI 命名与职责](/zh/p/ui-naming/#css-源码与发布名)。真正渲染 `.prose` 的入口显式调用 `feature-document/styles.html`；集合页只在实际输出正文时调用，预取诊断页也显式调用同一装配器。不通过页面类型或渲染后的 HTML 标签猜测需要哪些正文组件。

## 推荐写法

目录和产品集合页：

```yaml
params:
  slots: [breadcrumb]
```

文章页可通过其目录的 cascade 继承以下声明，无需再逐篇设置：

```yaml
params:
  slots: [breadcrumb, meta]
```

语言、外观页面由站点根 `content/` 维护，使用 `_index.md`，分别选择 `page-collection-language`、`page-collection-appearance`，并声明 `outputs: [HTML]`。布局提供选项，由语言、外观脚本处理操作。第一列不依赖 slot 声明。

Powered by 总览由站点根 `content/powered-by/index*.md` 维护，使用 `page-article-norss`。`theme-version`、`hugo-version` 输出主题和 Hugo 版本；`site-update "version"` 输出构建版本，`"interval"` 输出检查间隔，`"policy"` 输出缓存策略链接，`"offline"` 输出当前语言的离线页链接，`"status"` 输出程序状态和检查按钮，`"content"` 输出本页内容版本状态。`params.site_update.labels` 提供文案，检查不激活或重载页面。公共模板按 `site-update` 和 `page-actions` 短代码各加载一次所需脚本。离线页使用 `page-offline`，不装配导航、SW 管理或预取脚本。

各语言首页的 `description` 提供该语言的默认描述，页面可用自己的 `description` 覆盖。文章源码仓库使用 `hugo.toml` 中的 `params.content_source`。`params.slots` 中的 `meta` 控制当前文章元信息、章节目录和 BlogPosting。

首页链接已统一到普通入口。关于、微信、RSS、GitHub、备案等信息通过各自真实根页面访问，Powered by 入口展示技术总览并内嵌 PWA 状态面板；SEO 元数据仍由独立的 head 模板输出。

## 与导航状态和布局的边界

`params.slots` 决定页面装配哪些区域；`from / sorts` 表示当次浏览来源及排序。有效 `from` 决定来源根，没有有效来源时按真实内容祖先确定归属。例如 [Banyan 示例文章](https://banyan.swaw.com/zh/p/example-product/)直接访问时选中“文章 - 分类”；从产品分类进入时选中“产品 - 分类”。其他栏目通过 `_map.toml` 引用它时，正文网址保持不变，`from` 保留该次来源。

系统页使用普通链接，不携带 `return`；语言与外观页的返回行为见 [导航状态协议](/zh/p/navigation-state/)。切换语言留在对应语言的设置页，不改变当前系统入口的选中态。首页选中自身；其他页面匹配自身和最近的可列出祖先，但不把首页当成所有页面的默认选中项。没有可列出根祖先的内部页不强行选中入口。

第一列的存在不表示页面具有 collection browser。集合路径仍由 `params.slots` 中的 `breadcrumb`、集合来源和 provider 决定；不要新增 `slots.browser_mode`，也不要把来源、排序和列状态写入 front matter。

同一份入口列表和 slot 声明用于各屏幕宽度。整页横向画幅保持原有浏览位置；外观选择页在跟随系统、浅色和深色之间切换，所有页面共同消费 `params.appearance.palette` 指定文件中的语义色变量。演示站根配置选择 `site/theme.css`，站点可提供自己的完整配色文件。配色文件选择不属于 slot 契约，详见 [配色约定](/zh/p/site-configuration/#palette)。
