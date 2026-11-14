---
title: 站点配置
date: 2026-11-06
lastmod: 2026-11-14
url: p/site-configuration/
description: 设置根配置、语言、站点说明和主题覆盖文件。
weight: 2
---

## 根配置

本页在完整参考站点上修改配置。安装和预览命令见[开始使用](/zh/p/getting-started/)。示例只展示相关字段：在已有表中修改对应项，不要把整段追加到文件末尾。

在 `hugo.toml` 开头修改正式网址：

```toml
baseURL = "https://example.com/"
```

把示例域名换成自己的完整网址；如果部署在子目录中，连同子目录一起填写，例如 `https://example.com/blog/`。它影响站点地图、订阅和规范地址。本地预览仍使用终端显示的本机网址。

初次配置时保留其余构建设置，尤其是：

| 设置 | 保留它的原因 |
| --- | --- |
| `minify.disableJS = true` | 避免压缩改变脚本后，浏览器因 CSP 拒绝执行 |
| `module.mounts` 中的界面字典挂载 | 让界面使用站点的 `assets/i18n/` 字典 |
| `cascade` 中的 `build.publishResources = false` | 避免自动发布未使用的页面包文件，包括 `_map.toml` |
| `printPathWarnings`、`panicOnWarning` | 在页面发布网址冲突时停止构建 |

文章网址与栏目目录见[目录与引用](/zh/p/directories/)，索引开关见[站点发现](/zh/p/discovery/)，部署步骤见[首次部署](/zh/p/deploying/)。

## 站点说明与语言

先编辑首页。参考站的 `content/_index.md` 是英文首页，`content/_index.zh.md` 是中文首页，`content/_index.ar.md` 是阿拉伯文首页。例如，在中文首页修改已有字段：

```yaml
title: 我的站点
description: 介绍本站提供的内容。
```

`title` 用作站名；`linkTitle` 可单独设置导航文字。参考首页还设有 `params.browser_title`，它会覆盖浏览器标签标题，应一并修改或删除。各篇文章的 `description` 可覆盖首页提供的默认说明。

首页可见的风场文字来自它引用的艺术包，不是首页的 `title`。修改位置见下方“首页信号”；想先用简单文字首页，可按“最小首页艺术包”切换。

语言在 `hugo.toml` 的 `[languages]` 中设置：

```toml
[languages]
en.label = "English"
en.locale = "en-US"
en.weight = 1
zh.label = "中文"
zh.locale = "zh-Hans"
zh.weight = 2
```

`label` 是语言名称，`weight` 控制排列顺序；根配置的 `defaultContentLanguage` 决定默认语言。它不会随排列顺序改变。`defaultContentLanguageInSubdir` 决定默认语言是否也放在语言子目录中，调整后检查原有网址。

暂时不提供某种语言时，可在文件顶部、任何 TOML 表之前设置：

```toml
disableLanguages = ["ar"]
```

此例停用阿拉伯语，保留内容文件以便以后恢复；不要停用当前默认语言。改变默认语言前，要核对无语言后缀文件的归属，并检查各语言首页和文章是否仍发布到预期地址。

新增语言时，完成三处配置：在 `[languages]` 中声明语言，补齐 `assets/i18n/<语言代码>.toml` 界面字典，再添加同名页面的译文，如 `index.fr.md`、`_index.fr.md`。界面字典只翻译按钮等界面文字，不替代正文翻译。启用 SW 的站点还需要该语言的离线页。

参考站的界面字典挂载已配置，无需重复添加。语言选项图标与设置页见[选择列表](/zh/p/collection-lists/#怎样声明选择列表)。

## 配色 {#palette}

站点还需显式选择配色文件，路径相对于 `assets/`：

```toml
[params.appearance]
palette = "site/theme.css"
```

站点自行维护完整配色，Module 不提供默认配色。
默认使用 `site/theme.css`。需要高对比外观时，把上面的值改为 `site/theme.high-contrast.css`。
三套参考配色（默认、高对比度、Rose）都包含浅色和深色，不改变彩色图片。导航首项、列表头和全部 `h1` 默认无底线，也不保留边框占位；各 CSS 文件在对应变量旁提供恢复线条的注释示例。
自定义文件如 `assets/site/theme-custom.css`，配置为 `palette = "site/theme-custom.css"`。
修改后重新构建并部署；外观页继续在所选配色中切换跟随系统、浅色和深色。

### 自定义配色

复制完整配色文件后修改颜色，并将 `palette` 指向该文件。
同路径文件整体替换，不按 CSS 声明合并。配色文件维护颜色角色及其浅色、深色值，条目圆角使用 `--item-radius`，表头线可指定颜色及是否占位；列表结构、动画和交互规则保留在组件中。
`--item-current-marker` 控制当前项起始边线的颜色，设为 `transparent` 隐藏；线宽由组件固定为 2px。

`.item-list` 的 `--list-header-border` 和 `.prose` 的 `--prose-heading-border` 使用完整边框声明：`none` 取消线条和占位，`1px solid transparent` 隐藏线条并保留占位，`1px solid #888` 显示线条。单独定制正文栏标题线时，有目录按钮的页面在 `.document-heading` 中设置该变量，其余页面在 `.prose > h1.column-heading` 中设置。

| 作用域 | 颜色用途 |
| --- | --- |
| `:root` | 页面背景、正文、弱化文字、边框、强调色、链接和焦点 |
| `.icon` | 彩色图标的强调色和阴影；线条图标仍使用 `currentColor` |
| `.item-control` | 普通、已访问、悬停、焦点和当前项的文字、背景及边框 |
| `.item-list` | 列表标题和第一列首项的表头线 |
| `.prose` | 标题、分隔线、删除文字、代码、引用、图片、表格和语法高亮 |
| `.home-art-wind` | 风场艺术包中的锚点、地平线、信号和风向袋 |

无模式限定的作用域用于浅色和深色；深色规则只覆盖不同的值。
在对应作用域中修改颜色，并同时检查浅色和深色规则。
例如，修改表头背景时，替换已有的两处声明：

```css
.prose {
    --table-header-bg: #F4F4F4;
}
[data-theme="dark"] .prose {
    --table-header-bg: #252525;
}
```

正文表面和边框由 `--bg`、`--fg` 派生，需要色调时再混入 `--accent`。
内层混色控制与页面背景的差异，外层混色控制强调色的比例。例如：

```css
--code-block-bg: color-mix(in srgb, var(--accent) 3%, color-mix(in srgb, var(--fg) 3%, var(--bg)));
```

颜色角色可以使用固定值、别名或混色公式，不需修改组件 CSS。
不同用途保留独立角色，即使当前默认值相同。更换基础颜色后，检查两种模式中的文字、代码、
高亮行及其背景；固定的混色比例不能保证任意颜色组合都清晰。
升级主题时，将新增角色补入站点的配色副本，并对照上游检查已有角色。

## 最小首页艺术包

如果不需要风场，可先使用现成的文字首页：

1. 打开各语言 `content/_index*.md`，保留 `layout: page-home`。
2. 将正文中的 `home-art` 路径从 `/_res/home-art/wind` 改为 `/_res/home-art/minimal`。
3. 编辑 `content/_res/home-art/minimal/index*.md` 中的 `params.heading`、`params.description` 和 Markdown 正文。
4. 预览各语言首页，确认标题和内容都已替换。

需要独立定制时，先复制整个 `minimal/` 目录，再将首页引用改为新目录名。颜色与排版在包内 `style.css` 中修改；只改文字时不需要编辑模板。首页改用图片墙的步骤见[汇总图片墙](/zh/p/collection-lists/#汇总图片墙)。

## 首页信号

宿主首页 `content/_index*.md` 使用 `layout: page-home`，保存标题、说明、导航图标和权重。`params.show_navigation` 控制第一列导航，默认为 `true`。首页正文引用艺术包：

```text
{{</* home-art "/_res/home-art/wind" */>}}
```

修改 `content/_res/home-art/wind/index*.md`，设置首页标语与链接。每种语言分别修改，保留包内已有的模板、样式和脚本声明。以下是艺术页的页面元数据示例：

```yaml
---
title: 风场首页
params:
  template: scene.html.tmpl
  styles: [style.css]
  scripts: [script.js]
  brand_line: 为探索型发布提供清晰结构。
  signals:
    - Hugo
    - name: 使用文档
      url: /zh/articles/docs/
      primary: true
    - name: GitHub
      url: https://github.com/SwawHQ/banyan
---
```

字符串显示为可选中的文字；对象的 `name` 为显示名称，`url` 提供链接。首次点击选中并暂停信号，再次点击链接才跳转。外部链接在新标签打开。`primary: true` 使该项漂移周期加倍。

| 艺术页可选参数 | 默认值 | 用途 |
| --- | --- | --- |
| `wind_field_start_offset_rem` | `6` | 信号区域顶部距首页区域顶部的距离，单位为 rem |
| `signal_drift_seconds` | `90` | 普通信号漂移周期的基准秒数 |
| `signal_launch_gap_seconds` | `4` | 相邻信号启动的基准间隔秒数 |
| `signal_guide_chance` | `0` | 带拖尾引导线的信号比例，范围 0–100 |

## 覆盖主题文件

站点中的同路径布局和资源覆盖 Module 文件。升级前保留本站定制，并对照目标版本检查覆盖文件。

站点配置、内容和品牌资源由站点维护，Module 不补齐这些文件。完整源码包可以使用随包附带的本地主题构建；改用远程 Module 或托管构建时，固定发布版本并处理本地 `replace`。源码开发方法见[本地开发](/zh/p/local-development/)。

首页艺术包的模板、CSS 和 JS 在包内修改。模板不会自动转义 HTML；文字和 HTML 属性值须使用 `htmlEscape`，已渲染的 `.Content` 可直接输出。

## 站点状态页

从参考站点复制各语言的 `content/powered-by/index*.md`，在正文中维护说明、源码和变更记录链接。该页通过短代码显示版本和诊断信息：

| 短代码 | 显示内容 |
| --- | --- |
| `theme-version`、`hugo-version` | 主题与 Hugo 版本 |
| `site-status "version"` | 当前页面的站点构建版本 |
| `site-status "interval" "每 %d 分钟检查"` | 内容检查间隔 |
| `site-status "policy"`、`site-status "offline"` | 缓存策略与当前语言离线页链接 |
| `site-status "status"` | SW 程序状态与检查按钮 |
| `site-status "content"` | 本页与服务器的站点构建版本比对 |

`params.site_status.labels` 提供各语言文案。检查按钮只检查，不激活等待中的 SW，也不自动刷新页面。预取诊断见[预取配置](/zh/p/prefetch-stacks/#诊断)。

按需继续配置[页面区域](/zh/p/layout-slots/)、
[目录与引用](/zh/p/directories/)、[交付与缓存](/zh/p/delivery/)
和[站点发现](/zh/p/discovery/)。
