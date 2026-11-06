---
title: 站点配置
url: p/site-configuration/
description: 设置根配置、语言、站点说明和主题覆盖文件。
weight: 2
---

## 根配置

每个站点自行维护根 `hugo.toml`，包含站点信息、语言、构建设置和主题参数。
Module 不提供 `hugo.toml` 默认配置。Banyan 仓库根 `hugo.toml` 是最小演示站的完整示例，
新站点从完整根参考站点起步，并填写自己的 `baseURL` 和语言。
所有页面由站点根 `content/` 维护，包括 Powered by 和预取诊断；根参考站点保留全部页面。
Module 不提供内容默认页，只提供通用布局、脚本和样式。
删除不需要的根页面即可移除页面和入口，Module 不回填。内容栏目、关于页和 GitHub 介绍也由站点维护。

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

普通功能页可声明固定路径，例如 `url: my/`；`url` 不写开头的 `/`，
让 Hugo 保留当前语言前缀。栏目页包括语言和外观设置，地址由目录决定，不填写 `url`。
移动正文后保留 `url`，并更新 `_map.toml` 中的内容路径。
站点无需为各正文栏目配置 `[permalinks.page]`。

Banyan 演示中的 `content/articles/` 和 `content/products/` 都是普通目录。Swaw 的 `d`、`d-all`、`pr` 和 `pr-all` 入口是该站点的定制。跨栏目入口用 `_map.toml`
声明。在根配置顶层保留 `taxonomies = {}`，关闭 Hugo 默认分类。根 `[cascade.build]` 的
`publishResources = false` 默认让资源通过主题管线发布；设为 `true` 时，
Hugo 会自动发布内容包资源，包括 `_map.toml`。

`[build]`、`[minify]`、`[cascade]`、`[frontmatter]`、`[markup]`、`params`、
语言参数和输出格式均保留在站点根。最低 Hugo 版本由 Module 的 `theme.toml` 声明，站点无需重复配置 `module.hugoVersion.min`。

保留以下设置。它防止 HTML 压缩改变用于 CSP 哈希的内联 JS：

```toml
[minify]
disableJS = true
```

新站点使用 Skill 的[起始配置](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/install.md#configure-the-site-root)。
现有站点按需合并配置，保留自己的内容和 URL 规则。

## 站点说明与语言

```toml
[languages.en]
label = "English"
locale = "en-US"

[languages.zh]
label = "中文"
locale = "zh-Hans"

[[module.mounts]]
source = "assets/i18n"
target = "i18n"
```

各语言 `content/_index*.md` 的 `title` 提供该语言的站名，不能为空；不在 `hugo.toml` 重复设置。导航文字可用 `linkTitle` 单独设置，浏览器标题可用 `params.browser_title` 覆盖。

首页的 `description` 提供该语言的默认说明，不能为空。页面 front matter 的 `description` 优先，用于 SEO 和社交卡片。`llms.txt` 的介绍使用对应首页说明，页面条目只使用页面自己的 `description`，缺少时不补充说明。

`defaultContentLanguage` 选择默认语言；语言 `weight` 控制显示顺序，不改变默认站点。
`label` 设置语言名称，原生 `locale` 用于本地化、RSS 和 Open Graph。
参考站点使用英语 `en-US`、简体中文 `zh-Hans` 和阿拉伯语 `ar`；语言键为 `en`、`zh`、`ar`，阿拉伯语设置 `direction = "rtl"`。
RSS 使用完整 `locale`。Open Graph 只输出有明确地区的语言标签，如 `en_US`；无地区时省略可选的语言标记。
各语言设置页的 `params.language_icon` 设置语言选项图标，如 `{ text: "简" }`；未设置时使用语言图标。
设置页的 `params.icon` 单独控制导航入口图标。
增删语言时同步维护三处：根 `hugo.toml` 中的语言及启用设置、
`assets/i18n/<语言代码>.toml` 界面字典，以及所需的 `content/` 译文（包括首页）。
Banyan 根参考站点提供 `en`、`zh` 和 `ar` 字典；新增语言需补齐对应界面词条。
项目通过上述原生挂载读取 `assets/i18n/`，不另设字典路径参数。页面内容译文与界面字典分别维护，互不替代。
Module 不创建内容栏目。站点自行声明栏目根、布局和 `cascade`，再按需创建下级目录；Banyan 演示中的 `articles`、`articles-all`、`products` 和 `products-all` 可作参考。

## 配色 {#palette}

站点还需显式选择配色文件，路径相对于 `assets/`：

```toml
[params.appearance]
palette = "site/theme.css"
```

站点自行维护完整配色，Module 不提供默认配色。
参考站点使用根 `assets/site/theme.css`：浅色 4%、深色 10% 的选中与悬停底色，当前列表项显示起始边线。
根 `assets/site/theme.high-contrast.css` 保留原高对比选中、圆角和单色图片反色；设置 `palette = "site/theme.high-contrast.css"` 即可选择。
两份配色都包含浅色和深色，不改变彩色图片。
自定义文件如 `assets/site/theme-custom.css`，配置为 `palette = "site/theme-custom.css"`。
修改后重新构建并部署；外观页继续在所选配色中切换跟随系统、浅色和深色。

### 自定义配色

复制完整配色文件后修改颜色，并将 `palette` 指向该文件。
同路径文件整体替换，不按 CSS 声明合并。配色文件维护颜色角色及其浅色、深色值，条目圆角使用 `--item-radius`；布局、动画和交互规则保留在组件中。
`--item-current-marker` 控制当前项起始边线的颜色，设为 `transparent` 隐藏；线宽由组件固定为 2px。

| 作用域 | 颜色用途 |
| --- | --- |
| `:root` | 页面背景、正文、弱化文字、边框、强调色、链接和焦点 |
| `.icon` | 彩色图标的强调色和阴影；线条图标仍使用 `currentColor` |
| `.item-control` | 普通、已访问、悬停、焦点和当前项的文字、背景及边框 |
| `.list-header` | 列表标题边框 |
| `.prose` | 标题、分隔线、删除文字、代码、引用、图片、表格和语法高亮 |
| `.page-home` | 风场艺术包中的锚点、地平线、信号和风向袋 |

无模式限定的作用域用于浅色和深色；深色规则只覆盖不同的值。
保留各作用域及其深色规则，在角色定义处修改。CSS 变量的别名和混色在继承前解析；
只在 `:root` 修改正文角色，不能覆盖 `.prose` 中的同名定义。
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

## 首页信号

宿主首页 `content/_index*.md` 使用 `layout: page-home`，保存标题、说明、导航图标和权重。`params.show_navigation` 控制第一列导航，默认为 `true`。首页正文引用艺术包：

```text
{{</* home-art "/_res/home-art/wind" */>}}
```

站点在 `content/_res/home-art/wind/` 维护隐藏叶子包。各语言 `index*.md` 保存场景正文与参数，同目录的 CSS、JS 通过 `params.styles`、`params.scripts` 选择并以带指纹的外链发布。共用 `content/_res/_index.md` 的 `build` cascade 关闭这些内部资源页的 HTML、导航和站点发现。

例如艺术页的 front matter 和正文：

```yaml
---
title: 风场首页
params:
  styles: [style.css]
  scripts: [script.js]
  brand_line: 为探索型发布提供清晰结构。
  home_signals:
    - Hugo
    - name: 使用文档
      url: /zh/articles/docs/
      primary: true
    - name: GitHub
      url: https://github.com/SwawHQ/banyan
---

{{</* home-art/wind/scene */>}}
```

字符串显示为可选中的文字；对象的 `name` 为显示名称，`url` 提供链接。首次点击选中并暂停信号，再次点击链接才跳转。外部链接在新标签打开。`primary: true` 使该项漂移周期加倍。

| 艺术页可选参数 | 默认值 | 用途 |
| --- | --- | --- |
| `home_wind_field_start_offset_rem` | `6` | 信号区域顶部距首页区域顶部的距离，单位为 rem |
| `home_signal_drift_seconds` | `90` | 普通信号漂移周期的基准秒数 |
| `home_signal_launch_gap_seconds` | `4` | 相邻信号启动的基准间隔秒数 |
| `home_signal_guide_chance` | `0` | 带拖尾引导线的信号比例，范围 0–100 |

## 覆盖主题文件

站点中的同路径布局和资源覆盖 Module 文件；正文和页面配置直接在站点根 `content/` 修改。
站点自行维护完整 `assets/site/delivery.toml`、`assets/site/icons.toml` 与 `assets/i18n/` 界面字典，
以 Banyan 根参考站点为来源；Module 和传统主题目录不提供这些配置或界面字典。
升级主题后核对上游根文件差异，再修订自己的文件，不合并 Module 默认配置。
品牌、账号和法律文本放在站点中；可复用主题行为放在 Module 中。
根 `assets/site/` 中的图标和完整 manifest 模板由站点提供，Module 和传统主题目录不再提供。
已有站点接入前先补齐[图标和 manifest 清单](/zh/p/web-app/)；`assets/site/` 中的其它品牌素材为可选文件。
站点直接维护 `assets/site/manifest.webmanifest.tmpl`；Module 只读取并执行，发布为 `/site/site.<hash>.webmanifest`。
图像按指纹 URL 发布到 `/site/*`。完整配色也由站点维护，参考文件位于根 `assets/site/`。
风场的 CSS、JS 由站点艺术包提供；风向袋 SVG 由 `layouts/_shortcodes/home-art/wind/scene.html` 内联输出。修改形状时覆写该短代码模板；颜色继续由所选 CSS 调色板控制。
发布的主题只包含 Banyan 仓库的 `module/`，不包含演示内容和开发工具。文档与版本说明在 Banyan 仓库的 `content/articles/docs/` 和 `content/articles/changelog/` 维护，随参考站点发布到 `https://banyan.swaw.com/`。

Banyan 仓库根 `hugo.toml` 配置最小演示站，根 `go.mod` 将主题依赖替换为 `./module`。Swaw 本地开发通过 `../banyan/module` 使用同一源码；发布部署时需使用已发布的固定 Module 版本。
使用已发布 Module 的站点不应复制这个本地替换。

Powered by 的源码和变更记录链接在各语言 `content/powered-by/index*.md` 正文中维护，外链使用 `new-tab`。
删除旧 `params.theme_changelog` 和 `params.theme_repo` 配置即可。

按需继续配置[页面区域](/zh/p/layout-slots/)、
[目录与引用](/zh/p/directories/)、[交付与缓存](/zh/p/delivery/)
和[站点发现](/zh/p/discovery/)。
