---
title: 01 怎么构建和检查站点？
date: 2026-11-14
lastmod: 2026-11-17
url: p/deploying/
description: 构建正式产物，检查后交给托管平台发布。
---

先完成[第一篇文章](/zh/p/first-article/)。本页命令在站点根目录运行，使用[开始使用](/zh/p/getting-started/#取得站点)中定义的 `swban` 简称。

## 选择发布平台

- [Cloudflare Pages](/zh/p/cloudflare-pages/)：上传产物或连接 Git 仓库。
- [EdgeOne Makers](/zh/p/edgeone-makers/)：上传产物或连接 Git 仓库。

先按平台教程设置交付开关，并在 `hugo.toml` 中填写 `baseURL`。首次发布后才取得域名时，回填网址，再重新构建发布。其他静态托管可接收 HTML 和资源；响应头、缓存和重定向按平台规则设置。

## 构建与检查

先停止本地预览，选择本次独立的临时目录。Windows（PowerShell）：

```powershell
$build = Join-Path $env:TEMP ("swaw/banyan/publish/" + [IO.Path]::GetRandomFileName())  #选择本次产物目录
```

Linux 和 macOS：

```sh
mkdir -p "${TMPDIR:-/tmp}/swaw/banyan/publish"                       #准备临时目录
build=$(mktemp -d "${TMPDIR:-/tmp}/swaw/banyan/publish/site.XXXXXX")  #选择本次产物目录
```

三个平台都运行：

```text
swban build --destination "$build"  #构建站点和搜索索引
swban check/delivery "$build"       #检查交付产物
swban check/csp "$build"            #检查 CSP 与脚本完整性
swban base/browser/ensure           #准备浏览器检查工具
swban check/browser/site "$build"   #检查代表页面
```

每条命令成功后再执行下一条。构建不加 `-D`；草稿不会发布。产物目录应包含 `index.html`、各语言页面与资源。Cloudflare 还应有 `_headers` 和 `_redirects`，EdgeOne 应有 `edgeone.json`；没有重定向规则时，`_redirects` 为空文件。

查看报告中的失败项和跳过项。代表页面检查不覆盖全部文章，仍需检查自己的首页、导航、图片、外链和新文章。启用 SW 后的专项检查见[浏览器检查](/zh/p/browser-regression/)。

## 准备云平台工具

Windows x64 可另行安装 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) 管理授权和上传。已安装时从第二行开始：

```powershell
swban base/node/npx --yes skills add SwawHQ/swaw-clouds --skill swaw-clouds -y  #安装云平台 Skill
function swcl { & .\.agents\skills\swaw-clouds\swcl.cmd @args }             #定义命令简称
```

Linux 和 macOS 可使用平台控制台或原生工具，见对应平台教程。

## 准备 Git 源码

提交 `swban`、`swban.cmd`、`.agents/skills/swaw-banyan/`、`go.mod`、`go.sum` 和站点源码。工具缓存 `.tools/` 保留在本机。

发布包的托管构建使用根 `go.mod` 固定的主题版本。使用本地替换的独立站点可按[版本维护](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/upgrade.md#change-the-version)切换到正式 Module。自有站点需要的安装步骤和环境变量也应交给平台配置。

## 发布后检查

```text
swban check/http/security "<正式网址>"  #检查线上响应头
```

打开线上首页、新文章和各语言入口，检查站名、图片、导航和搜索。使用搜索查找本次文章，确认返回正确页面。

后续发布见[更新内容](/zh/p/publish-updates/)。
