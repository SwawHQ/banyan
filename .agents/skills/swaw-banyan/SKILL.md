---
name: swaw-banyan
description: 构建、预览、检查和同步 Banyan Hugo 站点，统计产物体积，并复用兼容工具或准备经过校验的便携版 Bun、Node、Git、GitHub CLI、Hugo 和 Go。
license: MIT
metadata:
  version: "0.1.0"
  module: "github.com/SwawHQ/banyan/module"
---

# Banyan 工具

本技能用于 Banyan 站点的配置、定制和检查。命令行工具目前支持 Windows x64。
站点内容和业务配置由使用主题的站点维护；可复用的主题改动归入 Banyan Module。

## 开始使用

在目标站点目录中，通过绝对路径调用本技能的 `swban.cmd`。
下文的 `swban` 均代表这个路径。

- 用 `swban help zh` 或 `swban help en` 查找命令；
  用 `swban <command> --help` 查看参数和默认值。
- 用 `swban ensure` 准备命令行运行环境。它优先复用兼容的 Bun 或 Node，
  两者都不可用时才下载便携版 Bun。使用本工具不需要在站点根目录添加
  package.json 或执行 npm install。
- 执行 Hugo 操作前，先用 `git.ensure`、`go.ensure`、`hugo.ensure` 准备工具。
  其他工具按需准备；`gh.ensure` 为可选项。
- `*.ensure` 复用兼容工具；加 `--force` 则安装固定版本的便携工具。
  `*.check` 检查已选工具。普通命令不会安装或重新选择工具。
- 依赖和便携工具放在技能指定的位置，不要向站点根目录添加本技能的工具依赖。

## 修改站点前检查版本配对

文件顶部的 front matter 是版本信息的唯一来源：
Skill 的 `metadata.version` 对应 `metadata.module` 指定的
Module 的 `v<metadata.version>` 版本。

进行与版本有关的配置、模板修改或迁移前，运行 `swban check/module [site]`。
检查时使用与目标构建一致的 Hugo 环境。

- 新站点：按[安装说明](references/install.md)安装固定版本的 Module 并配置站点。
  单纯安装 Skill 不会自动执行任何操作。
- 已有 Module：优先使用与它匹配的 Skill。版本不匹配时，报告双方版本，
  明确是升级 Module 还是更换 Skill。用户已授权升级时，不必再次询问。
- `development` 表示本地 Module 与 Skill 位于同一个 Banyan 工作副本，可继续开发。
  `missing`（缺少）、`mismatch`（不匹配）或 `unverified`（无法确认）需要先处理，
  再进行与版本有关的修改。调整后重新检查。

版本不匹配时，原生工具和无关检查仍可使用。

## 构建与预览

```text
swban hugo --minify --gc --cleanDestinationDir         #生产构建
swban hugo server -D --disableFastRender --port 13241  #开发预览
```

`hugo` 直接传递原生参数。用 `--destination <dir>` 指定其他输出目录。
站点配置须保留 `[minify] disableJS = true`，确保 HTML 压缩不会改变
计算 CSP 哈希时使用的内联 JS 字节。生产产物应压缩；
若站点配置在开发环境也启用了压缩，可用 `--minify=false` 关闭。

CSP 和部署响应头由 Hugo 生成。修改其源配置，不要直接修改生成的
`_headers` 或 `edgeone.json`。

## 根据改动选择检查

- 静态检查和体积报告读取已完成的构建，默认目录为 `public`。
  修改脚本或安全响应头后，运行 `check/csp`。
- 内容检查读取站点源文件，默认检查当前站点。
  HTTP 检查需要明确指定已部署的 URL。
- 浏览器检查可从 `check/browser/site <build>` 开始。
  准备方式、跳过的检查范围、测试页面要求及 SW 更新构建，
  见[浏览器检查](references/browser-site.md)。
- 默认使用 Chromium。涉及浏览器内核差异或已知回归问题时，
  选择已有的 `.webkit` 检查。
- 站点特有的文案、账号、路由和业务预期留在站点测试中；
  通用检查不负责验证这些事实。

选择参数前先阅读任务的 `--help`。报告失败项和跳过的检查范围；
按改动选择检查，不必每次执行所有任务。

## 其他任务

只读取当前任务需要的参考文档：

| 任务 | 参考文档 |
| --- | --- |
| 安装 Module 或与当前 Skill 配对 | [安装说明](references/install.md) |
| 查找可用命令 | [中文帮助](references/swban.help.zh-CN.md)或[英文帮助](references/swban.help.en.md) |
| 执行浏览器检查，包括 SW 更新 | [浏览器检查](references/browser-site.md) |
| 用 `sync/ext` 下载已声明的外部资源 | [外部资源](references/external-resources.md) |
| 同步生成的 EdgeOne 配置或规划部署 | [EdgeOne](references/edgeone.md) |
| 添加任务或编排站点测试套件 | [任务维护](references/tasks.md) |

Skill 工具在本地运行；托管构建使用平台自己的工具链。
EdgeOne 配置同步不会上传站点；本技能尚未提供部署上传命令。
