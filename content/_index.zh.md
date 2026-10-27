---
# 第一列导航包含首页和已发布的直属子页面。
title: Banyan
weight: 110
description: Banyan Hugo 主题的最小参考站点。
layout: page-home

params:
  # 图标也可使用 assets/site/icons.toml 中的名称，或 {image: "site/icon-192.png"}。
  icon: { text: "B" }
  # 浏览器标签页标题；上方 title 仍用于页面可见标题。
  browser_title: Banyan — 极简 Hugo 发布主题
  # 站点标题旁的简短说明。
  brand_line: 为探索型发布提供清晰结构。
  # 可选场景设置，以下为默认值。
  # home_signal_drift_seconds: 90       #基本周期，单位为秒。
  # home_signal_launch_gap_seconds: 4   #各信号启动的间隔，单位为秒。
  # home_wind_field_start_offset_rem: 6 #信号区域的顶部偏移，单位为 rem。
  # home_signal_guide_chance: 0         #带拖尾引导线的信号比例，范围为 0–100。
  # 按此顺序显示；省略 url 时只显示可选中的文字，不提供链接。
  home_signals:
    - name: 文章 - 全部
      url: /zh/articles-all/
      primary: true #将此信号的周期加倍；不改变导航优先级。
    - name: 文章 - 分类
      url: /zh/articles/
    - name: 产品 - 全部
      url: /zh/products-all/
    - name: 产品 - 分类
      url: /zh/products/
    - name: 使用文档
      url: https://swaw.com/zh/d/banyan/docs/
    - name: GitHub
      url: https://github.com/SwawHQ/banyan
---
