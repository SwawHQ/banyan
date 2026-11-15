---
title: 01 开始使用
date: 2026-11-06
lastmod: 2026-11-15
url: p/getting-started/
description: 取得参考站点，修改内容，在本地预览并准备首次部署。
---

首次使用按本页取得站点、准备工具并完成本地预览，再按[第二篇教程](/zh/p/site-configuration/)设置自己的站点。网站内容与配置由你维护；Banyan 主题提供页面布局，配套 Skill 提供本地工具和检查命令。

## 安装前

目前正在准备首次发布。发布标签可用前，可以使用当前仓库作本地预览；远程 Module 安装须等标签发布。

以下命令用于 Windows x64 的 PowerShell。首次运行需要联网下载缺少的工具，完成后可以复用。不需要另在站点根目录执行 `npm install`。主题要求 Hugo 0.168.0 或更新版本，Skill 会准备匹配工具。

## 取得站点

1. 在[项目 Releases](https://github.com/SwawHQ/banyan/releases)选择版本，下载 **Source code (zip)**。尚无发布版本时，在[仓库首页](https://github.com/SwawHQ/banyan)选择 **Code → Download ZIP**，取得当前开发版。
2. 完整解压到自己的站点目录。确认其中有 `hugo.toml`、`go.mod`、`module/`、`content/`、`assets/` 和 `.agents/`，不要只取 `module/`。
3. 在包含 `hugo.toml` 的目录打开 PowerShell。后面的命令都从这里运行。

完整源码包通过 `go.mod` 中的本地替换使用随包附带的 `module/`，因此预览时要保留该目录。以后改用已发布的 Module 时，再按下方“调整版本”处理。

先运行一次：

```powershell
function swban { & .\swban.cmd @args }  #在本终端定义命令简称
swban base/hugo version                                        #准备工具并显示 Hugo 版本
swban base/packages/ensure                                     #准备 Skill 核心依赖
swban doctor                                                   #检查工具、主题和 Skill
```

`swban` 是上面定义的 PowerShell 函数，不是自动加入 PATH 的命令。新开终端时重新定义，或使用完整的 `.\.agents\skills\swaw-banyan\swban.cmd` 路径。若命令报错，先按提示处理，再继续。

已有 Hugo 站点不要用参考站点整体覆盖。按 Skill 的[接入说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/install.md#add-the-module)添加主题，并合并缺少的配置、页面与资源。

## 本地预览

```powershell
swban base/hugo server -D --disableFastRender  #启动含草稿的本地预览
```

打开终端显示的本地网址，检查首页、导航和一篇文章。保存文件后，Hugo 会重新构建；浏览器通常会自动刷新。保持终端运行，结束预览时按 **Ctrl+C**。端口被占用时，在命令末尾加 `--port 13241`。

`swban build` 构建站点和搜索索引。`hugo server` 预览不会自动更新搜索索引。

`-D` 包含草稿，正式构建不包含草稿。预览地址只供本机检查，不是部署地址；Hugo 预览也不能验证云平台实际返回的响应头。

## 添加第一篇文章

先按 **Ctrl+C** 停止预览，再运行下面的命令。此例创建中文文章，继承参考站 `articles/` 的布局：

```powershell
swban base/hugo new content --kind banyan articles/my-post/index.zh.md  #创建中文文章
```

打开生成的 `content/articles/my-post/index.zh.md`：

1. 填写 `title` 和 `description`，在第二条 `---` 后写正文。正文小节从 `##` 开始。
2. 检查 `url`，例如 `p/my-post/`。以后移动文件时保留它，可以保持发布网址。
3. 准备公开时，将 `draft: true` 改为 `draft: false`，或删除 `draft` 字段。
4. 重新预览，在中文文章栏目中打开新文章。

图片放在文章同一目录中，例如 `photo.jpg`，正文可写 `![图片说明](photo.jpg)`。添加栏目和跨栏目引用见[目录与引用](/zh/p/directories/)。

## 构建与部署

完成预览后，先按[02 设置自己的站点](/zh/p/site-configuration/)修改基本配置，再按[03 首次部署](/zh/p/deploying/)构建、检查并发布。不要直接上传整个站点源码目录，也不要把本地预览服务当作正式站点。

## 调整版本

升级前保留本站文件与主题定制，在[版本说明](/zh/articles/changelog/)中选择目标版本。Skill 与主题使用配套版本；完整源码包的本地 `replace` 会优先于远程 Module 版本。

```powershell
swban upgrade/version/current  #查看当前版本与比对起点
swban help upgrade/git          #查看比较官方版本与保留本站定制的步骤
```

按[版本维护说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/upgrade.md#change-the-version)更新 Skill、主题和受影响的站点文件。只改版本号不会更新代码。升级后重新预览，并执行首次部署中的构建与检查。

## 下一步

完成本地预览和第一篇文章后，继续阅读[02 设置自己的站点](/zh/p/site-configuration/)，设置正式网址、站名和语言。
