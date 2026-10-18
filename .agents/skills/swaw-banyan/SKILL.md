---
name: swaw-banyan
description: 专用于：应用、定制、开发-测试、检查-部署 Swaw Banyan Hugo Theme，自带 Hugo、Go、Git、gh（GitHub CLI）、Bun/Node 准备。
license: MIT
metadata:
  version: "0.1.0"
  module: "github.com/SwawHQ/banyan/module"
---


仅安装目录应存在`swban.cmd`命令入口，目前支持 Windows x64。


```text
swban doctor [目录]       #检查工具和站点主题
swban help                #查看常用命令
swban help/zh 1           #查看一级分类
swban help/zh check 2     #查看 check 下两层命令
swban <command> --help    #查看参数和默认值
```



交付配置修改 `data/delivery.toml`；`_headers` 和 `edgeone.json` 由 Hugo 生成。


## 根据改动选择检查

- 修改交付配置或资源发布路径后，运行 `check/delivery`。
- 修改脚本或安全响应头后，运行 `check/csp`。
- 浏览器检查从 `check/browser/site <build>` 开始，准备方式和测试页面要求见
  [浏览器检查](references/browser-site.md)。默认使用 Chromium；
  涉及内核差异时，选择已有的 `.webkit` 检查。
- 站点特有的文案、账号、路由和业务预期留在站点测试中。

按改动选择检查，参数见任务的 `--help`。报告失败项和跳过的检查范围。

## 参考文档

只读取当前任务需要的参考文档：

| 任务 | 参考文档 |
| --- | --- |
| 调整环境诊断检查和修复提示 | [诊断配置](references/doctor.toml) |
| 安装或升级 Module | [安装说明](references/install.md) |
| 执行浏览器检查，包括 SW 更新 | [浏览器检查](references/browser-site.md) |
| 检查交付产物和指纹发布路径 | [交付检查](references/delivery.md) |
| 用 `sync/ext` 下载已声明的外部资源 | [外部资源](references/external-resources.md) |
| 同步生成的 EdgeOne 配置或规划部署 | [EdgeOne](references/edgeone.md) |
| 添加任务或编排站点测试套件 | [任务维护](references/tasks.md) |

托管构建使用平台自己的工具链；EdgeOne 任务只同步配置。
