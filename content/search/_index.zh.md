---
title: 搜索
layout: page-search
weight: 25
outputs: [HTML]
params:
  icon: search
  robots: noindex, follow
  slots: []
  # 使用 swban build 生成搜索索引；单独运行 Hugo 不会更新索引。
  index:
    # rss：当前语言首页 RSS 实际条目，包含 RSS 条数限制。
    # "**/*.html"：递归匹配 HTML；"*.html"：仅匹配根目录。
    # 数组取并集，例如 ["p/", "docs/**/*.html"]；目录以 / 结尾。
    # 路径相对当前语言发布根目录，不是 content/；目录递归匹配 HTML。
    # 默认语言位于站点根目录时，** 也会覆盖其他语言子目录。
    source: rss
    # 页内内容范围；使用已有的 class、id 或属性，各语言保持相同。
    selector: ".article .prose"
  labels:
    prompt: "输入关键词，搜索当前语言的内容。"
    loading: "正在搜索…"
    count: "找到 {count} 条结果"
    empty: "没有找到结果。"
    error: "搜索暂时不可用，请重试或刷新页面。"
    more: "更多结果"
    no_script: "请启用 JavaScript 后搜索。"
---
