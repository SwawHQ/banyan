---
title: 01 在本地运行站点
date: 2026-11-06
lastmod: 2026-11-17
url: p/getting-started/
description: 取得参考站点，准备工具并完成本地预览。
---

首次使用按本页取得站点、准备工具并完成本地预览，再按[第二篇教程](/zh/p/site-configuration/)设置自己的站点。网站内容与配置由你维护；Banyan 主题提供页面布局，配套 Skill 提供本地工具和检查命令。

## 安装前

支持 Windows x64、Linux x64 和 macOS x64/ARM64。首次运行会复用兼容的已有工具，并下载缺少的工具。不需要另在站点根目录执行 `npm install`。主题要求 Hugo 0.168.0 或更新版本，Skill 会准备匹配工具。Linux 需有 sh、基础系统工具、curl、tar、sha256sum；macOS 使用系统自带工具。Git 等工具缺少时会下载到本地目录，无需 Python、Homebrew 或 Xcode。

## 取得站点

1. 在[项目 Releases](https://github.com/SwawHQ/banyan/releases)选择版本，下载 **Source code (zip)**。尚无发布版本时，在[仓库首页](https://github.com/SwawHQ/banyan)选择 **Code → Download ZIP**，取得当前开发版。
2. 完整解压到自己的站点目录。确认其中有 `hugo.toml`、`go.mod`、`module/`、`content/`、`assets/` 和 `.agents/`，不要只取 `module/`。
3. 在包含 `hugo.toml` 的目录打开终端；Windows 使用 PowerShell。后面的命令都从这里运行。

发布包的 `go.mod` 固定了主题 Module 版本。`swban server` 和 `swban build` 使用该版本。`module/` 供主题开发使用，见[本地开发](/zh/p/local-development/)。

完整源码包提供根目录入口：Windows 用 `.\swban.cmd`，Linux 和 macOS 用 `sh ./swban`。例如，启动预览分别运行 `.\swban.cmd server` 或 `sh ./swban server`。

为简化后续命令，在当前终端定义 `swban` 简称。Windows（PowerShell）：

```powershell
function swban { & .\swban.cmd @args }  #在本终端定义命令简称
```

Linux 和 macOS：

```sh
swban() { sh ./swban "$@"; }  #在本终端定义命令简称
```

`swban` 简称不会自动加入 PATH。新开终端时重新定义，或直接使用根目录入口。各平台使用独立的站点副本，不要共用 `.tools/` 工具目录。

先运行一次；后续命令在三个平台相同。若命令报错，先按提示处理，再继续。

```text
swban base/hugo version     #准备工具并显示 Hugo 版本
swban base/packages/ensure  #准备 Skill 核心依赖
swban doctor               #检查工具、主题和 Skill
```

已有 Hugo 站点不要用参考站点整体覆盖。按 Skill 的[接入说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/install.md#add-the-module)添加主题，并合并缺少的配置、页面与资源。

## 本地预览

```powershell
swban server  #启动含草稿和搜索的本地预览
```

打开终端显示的本地网址，检查首页、导航和一篇文章。保存文件后，Hugo 会重新构建；浏览器通常会自动刷新。保持终端运行，结束预览时按 **Ctrl+C**。端口被占用时，在命令末尾加 `-p 13241`。

`swban server` 每次启动建立一次搜索索引，修改内容后需重启命令更新索引。`swban build` 构建正式站点和搜索索引。

开发服默认包含草稿，正式构建不包含草稿。使用 `swban server/lan` 可供同一局域网内的手机预览。上线步骤见[发布站点](/zh/p/deploying/)。

## 下一步

继续阅读[02 设置自己的站点](/zh/p/site-configuration/)，再完成[03 写第一篇文章](/zh/p/first-article/)。
