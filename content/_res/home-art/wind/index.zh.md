---
title: 风场首页

params:
  styles: [style.css]
  scripts: [script.js]
  brand_line: 为探索型发布提供清晰结构。
  # home_signal_drift_seconds: 90       #基本周期，单位为秒。
  # home_signal_launch_gap_seconds: 4   #各信号启动的间隔，单位为秒。
  # home_wind_field_start_offset_rem: 6 #信号区域的顶部偏移，单位为 rem。
  # home_signal_guide_chance: 0         #带拖尾引导线的信号比例，范围为 0–100。
  # 信号按条目顺序显示；省略 url 时只显示可选中的文字。
  home_signals:
    - name: 文章 - 全部
      url: /zh/articles-all/
      primary: true #将此信号的周期加倍。
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

{{< home-art/wind/scene >}}
