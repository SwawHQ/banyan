---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
# The theme renders the sole article H1 from title; start body headings at ##.
# Optional concise noun phrase for navigation, lists, and breadcrumbs:
# linkTitle: ""
date: {{ .Date }}
lastmod: {{ .Date }}
draft: true
url: "p/{{ .File.ContentBaseName | urlize }}/"
description: ""

# 其他平台发布的文章链接；GitHub 源文件链接由主题自动生成。
# published_links:
# - label: 公众号
#   url: https://example.com/article

# 别名，用于向后兼容，例如更换 url 时保留旧链接不会 404
# aliases:
# - /old-url-path/

# 正文按实际目录归属；其他栏目在其 _map.toml 中引用本文内容路径。
---
