---
title: 开始使用
slug: getting-started
description: 安装配套的 Banyan Hugo Module 和 Agent Skill。
weight: 1
---

Banyan 分为两部分：Hugo Module 提供主题，`swaw-banyan` Agent Skill
提供本地工具和检查。站点内容、配置和品牌资料由使用主题的站点维护。

## 安装前

本项目正在准备首次发布。下面的 `v0.1.0` 是首发版本示例；
远程安装须等对应标签发布。发布前可按 Skill 的
[本地 Module 示例](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/install.md#test-an-unpublished-module)
验证临时站点，或[预览本仓库](/zh/docs/development/local-development/)。

主题要求 Hugo 0.157.0 或更新版本。Skill 命令行目前支持 Windows x64，
优先复用兼容的系统工具，也可下载便携工具。它支持 Bun 或 Node，
不需要在站点根目录添加 `package.json` 或执行 `npm install`。

## 选择安装入口

- **先装 Skill：** 从仓库的 `v0.1.0` 标签提取 `.agents/skills/swaw-banyan/`，
  放到站点的同名目录。也可使用支持指定 ref 的 Skill 安装器。
  让 Agent 按 Skill 配置站点并安装匹配的 Module。复制 Skill 本身不会运行命令。
- **已有 Module：** 在站点中查看 `hugo mod graph`，从对应仓库标签安装 Skill。
  仅安装配套 Skill 不需要升级 Module。
- **两者均已安装：** 从站点根目录运行 `swban check/banyan`。
  版本不匹配时，使用配套 Skill，或按计划升级 Module。

以 `theme = "banyan"` 加载本地主题目录时，`check/banyan` 也会检查其
`theme.toml` 版本；缺少版本时报告 `unverified`。

版本以 [SKILL.md metadata](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/SKILL.md)
为准。Skill `0.1.0` 对应 Module `v0.1.0`；项目标签 `v0.1.0` 和
Module 标签 `module/v0.1.0` 指向同一提交。`module/` 前缀供 Go 识别子目录 Module
的版本；GitHub Release 使用项目标签。同一 Git 工作副本中的本地 Module 配对结果为 `development`。
解压整仓源码时，内置 Skill 按 `module/theme.toml` 的版本配对。

## 配置站点

下文中的 `swban` 代表已安装 Skill 的 `.\.agents\skills\swaw-banyan\swban.cmd`。
从目标站点根目录按路径调用。入口按需准备 JS 运行时、Git、Go 和 Hugo。
站点任务会先检查 Skill 与主题版本配对；帮助和基础工具仍可用于安装和调整版本。

按 Skill 的[安装说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/install.md)
初始化站点 Module、固定主题版本，并创建首页和分类 bundle。
该说明包含可构建的英文起始配置和 vendor 更新步骤。

完成后，按[站点配置](/zh/docs/guide/site-configuration/)设置语言和站点说明，
再选择[列表](/zh/docs/guide/collection-lists/)与[分类法](/zh/docs/guide/taxonomies/)。

## 调整版本

先选择目标版本 `vX.Y.Z`。升级和降级使用相同步骤。
在[项目 Releases](https://github.com/SwawHQ/banyan/releases) 中选择该版本，
下载 **Source code (zip)**。也可下载标签源码：
`https://github.com/SwawHQ/banyan/archive/refs/tags/vX.Y.Z.zip`。

- **Skill：** 从项目标签 `vX.Y.Z` 取得 `.agents/skills/swaw-banyan/`，
  更新完整的 Skill 源文件。
- **Module：** 在站点根目录运行下列命令。使用 `_vendor/` 时，再更新 vendor 文件。
  本地 `replace` 会优先生效；改用发布版前须移除它。
- **主题目录：** 用 ZIP 中的 `module/` 替换站点实际加载的主题目录，例如 `themes/banyan/`。
  该目录中应直接包含 `theme.toml`、`layouts/` 和 `assets/`。
  替换前处理主题中的本地改动；站点定制应保留在站点目录。

```text
swban base/hugo mod get github.com/SwawHQ/banyan/module@vX.Y.Z     #选择 Module 版本
swban base/hugo mod vendor                                         #更新 vendor 文件（使用时）
swban check/banyan                                                 #检查 Skill 与主题配对
```

只修改 `SKILL.md` 或 `theme.toml` 中的版本号，不会更新代码。
