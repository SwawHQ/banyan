---
title: 01 怎么修改首页内容？
date: 2026-11-15
lastmod: 2026-11-20
url: p/appearance-customization/
description: 在首页只显示根导航列，或修改风场的标语、文字和链接。
---

参考站使用风场首页。文字首页见[切换到文字首页](/zh/p/home-minimal/)，全站颜色见[修改配色](/zh/p/palette/)。

## 只显示根导航列

打开对应语言的 `content/_index*.md`，保留 `layout: page-home` 和 `params.show_navigation: true`，将第二个 `---` 之后的正文留空。要恢复风场，把下方短代码放回正文即可。

## 修改风场

首页 `content/_index*.md` 使用 `layout: page-home`，保存标题、说明、导航图标和权重。`params.show_navigation` 控制第一列导航，默认为 `true`。首页正文引用艺术包：

```text
{{</* home-art "/_res/home-art/wind" */>}}
```

1. 打开 `content/_res/home-art/wind/index.zh.md`。
2. 修改 `params.brand_line`，设置首页标语。
3. 修改 `params.signals` 中的文字和链接，保留模板、样式和脚本声明。
4. 按相同步骤修改其他语言的 `index*.md`。

例如：

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
      url: /zh/articles/docs-start/
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

## 检查结果

运行 `swban server`，打开各语言首页，确认标语和链接已替换。点击信号文字可选中并暂停，再次点击链接可打开目标页面。

需要独立设计时，参见[制作自己的首页](/zh/p/home-art/)。
