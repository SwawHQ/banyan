---
title: 站点配置
slug: site-configuration
description: 设置根配置、语言、站点说明和主题覆盖文件。
weight: 2
---

## 根配置

在站点根 `hugo.toml` 中设置 `baseURL`、`title` 和语言。
Hugo 的 `[outputs]`、`[taxonomies]` 和 `[permalinks]` 也须由站点声明。
Banyan 提供 `[outputFormats]` 定义，站点仍须通过 `[outputs]` 启用对应输出。

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
优先于站点说明，用于 SEO 和社交卡片；`llms.txt` 的介绍和首页条目也使用站点说明。

`locale` 用于 Open Graph。可选 `icon` 为语言选择列表提供短标记；
未设置时使用语言图标。为每种启用的语言声明根配置，并创建对应的首页和分类 bundle。

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
