---
title: 站点配置
url: p/site-configuration/
description: 设置根配置、语言、站点说明和主题覆盖文件。
weight: 2
---

## 根配置

每个站点自行维护根 `hugo.toml`，包含站点信息、语言、构建设置和主题参数。
Module 不再提供 `hugo.toml` 默认配置。本仓库根 `hugo.toml` 是演示站的完整示例，
新站点按需取用，并填写自己的 `baseURL`、`title` 和语言。
目录页可由 Module 内容提供；站点的同路径文件覆盖 Module 文件。

根配置启用 `printPathWarnings = true` 和 `panicOnWarning = true`。
Hugo 检测重复输出路径并中止构建，覆盖未列出的页面及各输出格式。

生成 `llms.txt` 时，站点需声明输出格式，并在首页启用它：

```toml
[outputFormats.LLMS]
mediaType = "text/plain"
baseName = "llms"
isPlainText = true
notAlternative = true

[outputs]
home = ["HTML", "RSS", "LLMS"]
```

普通页面在 front matter 中直接声明固定网址：

```yaml
url: p/article-name/
```

功能页面使用各自的路径，例如 `url: language/`。`url` 不写开头的 `/`，
让 Hugo 保留当前语言前缀。栏目页仍使用目录路径，无需填写 `url`。
移动正文后保留 `url`，并更新 `_map.toml` 中的内容路径。
站点无需为各正文栏目配置 `[permalinks.page]`。

`content/discover/` 和 `content/tools/` 都是普通目录。跨栏目入口用 `_map.toml`
声明。保留空的 `[taxonomies]`，关闭 Hugo 默认分类。根 `[cascade.build]` 的
`publishResources = false` 默认让资源通过主题管线发布；设为 `true` 时，
Hugo 会自动发布内容包资源，包括 `_map.toml`。

`[build]`、`[minify]`、`[cascade]`、`[frontmatter]`、`[markup]`、`params`、
语言参数和输出格式均保留在站点根。`[module.hugoVersion]` 声明站点所需的最低 Hugo 版本。

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

[languages.en]
label = "English"
locale = "en-US"
[languages.en.params]
icon = { text = "EN" }

[languages.zh]
label = "中文"
locale = "zh-CN"
[languages.zh.params]
description = "站点中文说明。"
icon = { text = "简" }
```

`params.description` 提供全站说明。各语言可用
`languages.<lang>.params.description` 覆盖。页面 front matter 的 `description`
优先于站点说明，用于 SEO 和社交卡片。`llms.txt` 的介绍使用站点说明，
页面条目只使用页面自己的 `description`，缺少时不补充说明。

`label` 设置语言名称，原生 `locale` 用于本地化、RSS 和 Open Graph。
演示站使用 `en-US`、`zh-CN`、`zh-TW`；Open Graph 输出下划线格式。
`languages.<lang>.params.icon` 设置语言选择列表的标记，如 `EN`、`简`、`繁`。
未设置 `icon` 时使用语言图标。
为每种启用的语言声明根配置，并创建对应的首页。
Module 提供三语言的 `discover` 和 `tools` 目录根；站点按需创建下级目录。

站点还需显式选择配色文件，路径相对于 `assets/`：

```toml
[params.appearance]
palette = "css/theme.css"
```

内置黑白灰配色使用 `css/theme-monochrome.css`。也可填写站点自己的完整配色文件路径。

## 首页信号

在各语言的 `content/_index*.md` 中使用 `layout: page-home`，并按需设置：

```yaml
brand_line: 为探索型发布提供清晰结构。
home_signals:
  - Hugo
  - name: 使用文档
    url: /zh/discover/docs/
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

按需继续配置[页面区域](/zh/p/layout-slots/)、
[目录与引用](/zh/p/directories/)、[交付与缓存](/zh/p/delivery/)
和[站点发现](/zh/p/discovery/)。
