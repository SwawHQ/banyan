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
- **两者均已安装：** 从站点根目录运行 `swban check/module`。
  版本不匹配时，使用配套 Skill，或按计划升级 Module。

版本以 [SKILL.md metadata](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/SKILL.md)
为准。Skill `0.1.0` 对应 Module `v0.1.0`；仓库标签分别为
`v0.1.0` 和 `module/v0.1.0`。同一工作副本中的本地 Module 配对结果为 `development`。

## 配置站点

下文中的 `swban` 代表已安装 Skill 的 `swban.cmd`。从目标站点根目录按路径调用：

```text
.\.agents\skills\swaw-banyan\swban.cmd ensure       #准备命令行运行环境
.\.agents\skills\swaw-banyan\swban.cmd git.ensure   #准备 Git
.\.agents\skills\swaw-banyan\swban.cmd go.ensure    #准备 Go
.\.agents\skills\swaw-banyan\swban.cmd hugo.ensure  #准备 Hugo
```

按 Skill 的[安装说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/install.md)
初始化站点 Module、固定主题版本，并创建首页和分类 bundle。
该说明包含可构建的英文起始配置和 vendor 更新步骤。

完成后，按[站点配置](/zh/docs/guide/site-configuration/)设置语言和站点说明，
再选择[列表](/zh/docs/guide/collection-lists/)与[分类法](/zh/docs/guide/taxonomies/)。
