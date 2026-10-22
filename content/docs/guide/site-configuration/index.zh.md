---
title: 站点配置
slug: site-configuration
description: 设置根配置、语言、站点说明和主题覆盖文件。
weight: 2
---

## 根配置

在站点根 `hugo.toml` 中设置 `baseURL`、`title` 和语言。
Hugo 默认不从主题合并 `[outputs]`、`[taxonomies]` 和 `[permalinks]`；
本项目在站点根显式声明它们。Banyan 提供 `[outputFormats]` 定义，
站点通过 `[outputs]` 启用对应输出。
分类页可由 Module 内容提供；站点的同路径文件覆盖 Module 文件。

`[build]`、`[minify]`、`[cascade]`、`[frontmatter]`、`[pagination]` 和 `[markup]`
保留在站点根；它们默认不从 Module 合并。通用 `params`、语言 `params`
和 `[outputFormats]` 可由 Module 提供默认值，站点只声明自己的覆盖值。

保留以下设置。它防止 HTML 压缩改变用于 CSP 哈希的内联 JS：

```toml
[minify]
disableJS = true
```

新站点使用 Skill 的[起始配置](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/install.md#configure-the-site-root)。
现有站点按需合并配置，保留自己的内容和 URL 规则。

## 站点说明与语言

```toml
[params]
description = "Your site description."

[languages.en.params]
locale = "en_US"
icon = { text = "EN" }

[languages.zh.params]
description = "站点中文说明。"
locale = "zh_CN"
```

`params.description` 提供全站说明。各语言可用
`languages.<lang>.params.description` 覆盖。页面 front matter 的 `description`
优先于站点说明，用于 SEO 和社交卡片。`llms.txt` 的介绍使用站点说明，
页面条目只使用页面自己的 `description`，缺少时不补充说明。

`locale` 用于 Open Graph。Module 已提供 `en_US`、`zh_CN` 和 `zh_TW`，
站点仅在需要不同值时覆盖。Module 还提供 `EN`、`简`、`繁` 作为语言选择列表的默认标记；
站点可用 `icon` 覆盖。其他语言未设置 `icon` 时使用语言图标。
为每种启用的语言声明根配置，并创建对应的首页。
Module 提供三语言的 `tags`、`tools` 分类根页面；站点创建自己使用的标签词项 bundle。

## 首页信号

在各语言的 `content/_index*.md` 中使用 `layout: page-home`，并按需设置：

```yaml
brand_line: 为探索型发布提供清晰结构。
home_signals:
  - Hugo
  - name: 使用文档
    url: /zh/docs/
    primary: true
  - name: GitHub
    url: https://github.com/SwawHQ/banyan
```

字符串显示为可选中的文字；对象的 `name` 为显示名称，`url` 提供链接。
首次点击选中并暂停信号，再次点击链接才跳转。外部链接在新标签打开。
`primary: true` 使该项漂移周期加倍；省略时使用普通周期。

| 可选字段 | 默认值 | 用途 |
| --- | --- | --- |
| `home_wind_field_start_offset_rem` | `6` | 信号区域顶部距首页区域顶部的距离，单位为 rem |
| `home_signal_drift_seconds` | `90` | 普通信号漂移周期的基准秒数，各项有小幅错开 |
| `home_signal_launch_gap_seconds` | `4` | 相邻信号启动时间的基准间隔，单位为秒 |

## 覆盖主题文件

站点中的同路径内容、资源和数据覆盖 Module 默认文件。
品牌、账号和法律文本放在站点中；可复用主题行为放在 Module 中。
发布的主题只包含 `module/`，不包含本仓库的文档内容和工具。

本仓库根 `hugo.toml` 配置文档站点，根 `go.mod` 将主题依赖替换为 `./module`。
使用已发布 Module 的站点不应复制这个本地替换。

`params.theme_changelog` 设置 Powered by 中的主题发布说明链接。
默认指向上游仓库的变更记录；本仓库设置为 `/changelog/`，中文为 `/zh/changelog/`。

按需继续配置[页面区域](/zh/docs/guide/layout-slots/)、
[分类法](/zh/docs/guide/taxonomies/)、[交付与缓存](/zh/docs/guide/delivery/)
和[站点发现](/zh/docs/guide/discovery/)。
