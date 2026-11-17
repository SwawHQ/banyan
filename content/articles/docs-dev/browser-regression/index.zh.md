---
title: 检查：浏览器检查
date: 2026-11-06
lastmod: 2026-11-17
url: p/browser-regression/
description: 使用 Skill 对已完成的站点构建运行代表页面和专项检查。
---

在目标站点根目录使用[开始使用](/zh/p/getting-started/#取得站点)中定义的 `swban` 简称，适用于 Windows、Linux 和 macOS。参数、默认值和页面要求以任务的
`--help` 为准，检查范围见 Skill 的[浏览器说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/browser-site.md)。

```text
swban base/browser/ensure                                    #准备 Chromium
swban check/browser/site <build>                             #检查代表页面
swban check/browser/site <build> --updates                   #检查 SW 更新
swban check/browser/site <build> --updates --site <source>   #指定更新构建源码
swban check/browser/site <build> --trace --out <report>      #保存报告和 trace
swban check/browser/pwa/disable <enabled> --next <disabled>  #检查 SW 停用
swban check/browser/csp <build> --page <path>                #检查指定页面 CSP
swban check/browser/site --help                              #查看参数
```

检查服务已完成的构建，并应用其生成的 `_headers`。报告列出所选路径、失败项和
跳过范围；代表页面检查不覆盖每个页面或全部任务。普通 UI 检查阻止 SW，
需要实际 worker 的 PWA 和预取检查单独启用。

检查会自动识别部署子目录和默认语言首页，无需为检查临时修改 `baseURL` 或语言设置。单页检查的 `--page` 使用实际访问路径，例如 `/blog/zh/p/banyan/`。SW 停用检查也使用实际部署范围；未指定 `--page` 时自动选择语言首页。

`--updates` 使用源码站点的正常配置，改变构建版本并为 SW 添加注释，生成可触发程序更新的临时构建。
源码和受检产物须来自同一站点及配置。测试两次实际代码变化时，给单项 PWA
任务传入两份构建。默认临时产物在结束时清理；报告按 `--out` 选择保留位置。

派生配色角色及引擎敏感行为使用单项检查；已有 `.webkit` 入口复用同一契约。
业务文案、账户、品牌和专用旅程留在消费站，组合方式见
[任务维护](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/tasks.md#compose-a-site-suite)。
主题源码与故障 fixture 见 [tests/README.md](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。
