---
title: 外观 · 配色与首页定制
date: 2026-11-15
lastmod: 2026-11-15
url: p/appearance-customization/
description: 选择配色，修改首页艺术包，并按需要覆盖主题文件。
---

先完成[站点基本设置](/zh/p/site-configuration/)，再按需要修改外观。只改首页文字时，直接阅读“最小首页艺术包”或“首页信号”。

## 配色 {#palette}

编辑 `hugo.toml` 中已有的配色设置；文件路径相对于 `assets/`：

```toml
[params.appearance]
palette = "site/theme.css"
```

站点自行维护完整配色，Module 不提供默认配色。
默认使用 `site/theme.css`。需要高对比外观时，把上面的值改为 `site/theme.high-contrast.css`。
三套参考配色（默认、高对比度、Rose）都包含浅色和深色，不改变彩色图片。标题线的定制示例见各配色文件中的变量注释。
自定义文件如 `assets/site/theme-custom.css`，配置为 `palette = "site/theme-custom.css"`。
修改后重新构建并部署；外观页继续在所选配色中切换跟随系统、浅色和深色。

### 自定义配色

复制完整配色文件后修改颜色，并将 `palette` 指向该文件。
同路径文件整体替换，不按 CSS 声明合并。配色文件维护颜色角色及其浅色、深色值，条目圆角使用 `--item-radius`，表头线可指定颜色及是否占位；列表结构、动画和交互规则保留在组件中。
`--item-current-marker` 控制当前项起始边线的颜色，设为 `transparent` 隐藏；保留标记宽度。

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
      url: /zh/articles/docs-guide/
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

站点配置、内容和品牌资源由站点维护，Module 不补齐这些文件。完整源码包可以使用随包附带的本地主题构建，包括托管构建。远程 Module 与本地替换路径的选择见[首次部署](/zh/p/deploying/#git-托管构建)，源码开发方法见[本地开发](/zh/p/local-development/)。

首页艺术包的模板、CSS 和 JS 在包内修改。模板不会自动转义 HTML；文字和 HTML 属性值须使用 `htmlEscape`，已渲染的 `.Content` 可直接输出。
