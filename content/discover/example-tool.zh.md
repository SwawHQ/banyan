---
title: Banyan CLI
date: "2026-10-21T00:00:00+08:00"
url: p/example-tool/
description: 检查 Banyan 站点和构建后的页面元信息。
offer:
  amount: 0
  currency: "$"
  value: 检查站点配置和构建后的页面元信息。
---

Banyan CLI 随 `swaw-banyan` skill 提供。在站点目录运行以下命令。检查 `public` 前，先构建站点。

```text
swban doctor .                    #检查站点和工具
swban check/html/metadata public   #检查构建后的页面元信息
```

`free` 和 `first-party` 目录用 `_map.toml` 引用本文。产品列表显示“免费”和 `offer` 中的价值说明。
