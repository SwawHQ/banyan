---
title: 01 怎么修改首页内容？
date: 2026-11-15
lastmod: 2026-11-20
url: p/appearance-customization/
description: 在首页只显示根导航列，或修改风场的标语、文字和链接。
---

参考站的根地址只显示导航列。选择「首页」后，在对应语言的 `home/` 显示风场。文字首页见[切换到文字首页](/zh/p/home-minimal/)，全站颜色见[修改配色](/zh/p/palette/)。

## 只显示根导航列

根导航列出当前语言的直属页面。根地址使用 `layout: page-root-navigation`，打开时没有选中项。

## 修改风场

打开 `content/home/index*.md`，在正文中编辑 `art-wind` 的 JSON。`brand_line` 设置标语，`signals` 设置文字和链接。文章正文也可以使用同一个短代码。

```text
{{</* art-wind */>}}
{"page_heading":true,"brand_line":"欢迎来访","signals":[{"name":"使用文档","url":"/zh/articles/docs-start/","primary":true}]}
{{</* /art-wind */>}}
```

字符串显示为可选中的文字；对象的 `name` 为显示名称，`url` 提供链接。首次点击选中并暂停信号，再次点击链接才跳转。外部链接在新标签打开。`primary: true` 使该项漂移周期加倍。

| 风场可选参数 | 默认值 | 用途 |
| --- | --- | --- |
| `page_heading` | `false` | 风场默认使用二级标题。让其中一个风场提供整页一级标题时设为 `true` |
| `wind_field_start_offset_rem` | `6` | 信号区域顶部距风场区域顶部的距离，单位为 rem |
| `signal_drift_seconds` | `90` | 普通信号漂移周期的基准秒数 |
| `signal_launch_gap_seconds` | `4` | 相邻信号启动的基准间隔秒数 |
| `signal_guide_chance` | `0` | 带拖尾引导线的信号比例，范围 0–100 |

## 检查结果

运行 `swban server`，打开各语言首页，确认标语和链接已替换。点击信号文字可选中并暂停，再次点击链接可打开目标页面。

需要独立设计时，参见[制作自己的首页](/zh/p/home-art/)。
