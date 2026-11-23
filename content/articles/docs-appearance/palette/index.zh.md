---
title: 06 怎么修改配色？
date: 2026-11-17
lastmod: 2026-11-17
url: p/palette/
description: 选择配色文件，修改颜色并检查两种外观模式。
---

先完成[站点设置](/zh/p/site-configuration/)，再选择或复制一套配色。

## 配色 {#palette}

编辑 `hugo.toml` 中已有的配色设置；文件路径相对于 `assets/`：

```toml
[params.appearance]
palette = "site/theme.css"
```

Module 在 `assets/site/` 提供三套完整配色。
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

## 检查结果

重新预览，分别选择浅色和深色，检查正文、链接、代码和当前导航项。确认文字清晰后重新构建并部署。
