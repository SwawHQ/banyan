---
title: 首次部署
date: 2026-11-14
lastmod: 2026-11-14
url: p/deploying/
description: 选择平台，构建和检查正式产物，再上传并检查线上页面。
weight: 3
---

先完成[开始使用](/zh/p/getting-started/)。本页的 PowerShell 命令从站点根目录运行，并使用该页定义的 `swban` 简称。引号中的 `<项目名>`、`<正式网址>` 等是需要替换的占位符。

## 选择部署方式

| 方式 | 需要提供 | 适用情况 |
| --- | --- | --- |
| 本地构建后上传 | 检查通过的 HTML 和资源目录 | 先在本机完成构建，再发布 |
| Git 托管构建 | 站点源码仓库与平台构建配置 | 推送代码后由平台自动构建和发布 |

下面先说明本地构建后上传。Cloudflare 的 Direct Upload 项目不能直接改成 Git 集成项目；需要自动构建时，应在创建项目时选择 Git 集成。见[平台说明](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

在所选平台建立账号并确定目标项目。将 `hugo.toml` 的 `baseURL` 设为要公开使用的网址；若首次上传后才取得平台域名，取得后回填该值，重新构建并上传。绑定自有域名后也要更新它。

## 设置平台

编辑已有的 `assets/site/delivery.toml`，找到 `[platform]` 下的开关。只使用 Cloudflare Pages 时：

```toml
[platform]
cloudflare.pages.enabled = true
edgeone.makers.enabled = false
```

只使用 EdgeOne Makers 时交换两个值。修改已有项，不要把示例追加为重复的表；保留文件中的其他设置。缓存和重定向的含义见[交付与缓存](/zh/p/delivery/)。

## 构建与检查

先停止本地预览。以下命令使用本次独立的临时目录，避免混入旧产物：

```powershell
$build = Join-Path $env:TEMP ("swaw/banyan/publish/" + [guid]::NewGuid())  #选择本次产物目录
swban base/hugo --minify --destination "$build"                         #构建正式站点
swban check/delivery "$build"                                          #检查交付产物
swban check/csp "$build"                                               #检查 CSP 与脚本完整性
swban base/browser/ensure                                             #准备浏览器检查工具
swban check/browser/site "$build"                                      #检查代表页面
```

每条命令成功后再执行下一条。构建不加 `-D`；草稿不会发布。产物目录应包含 `index.html`、各语言页面与资源。Cloudflare 还应有 `_headers`，EdgeOne 应有 `edgeone.json`；没有重定向规则时不要求 `_redirects`。

查看报告中的失败项和跳过项。代表页面检查不覆盖全部文章，仍需检查自己的首页、导航、图片、外链和新文章。启用 SW 后的专项检查见[浏览器检查](/zh/p/browser-regression/)。

## 安装上传工具

本地上传使用独立的 Swaw Clouds Skill。若站点已有 `.agents/skills/swaw-clouds/`，直接定义简称；否则先安装：

```powershell
swban base/node/npx --yes skills add SwawHQ/swaw-clouds --skill swaw-clouds -y  #安装云平台 Skill
function swcl { & .\.agents\skills\swaw-clouds\swcl.cmd @args }                 #在本终端定义简称
```

授权由浏览器完成。不要把 Token 写入页面或站点配置。已有登录可以复用；授权和账号问题见 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds)。

## 上传到 Cloudflare Pages

先登录，再创建项目。已有目标项目时跳过创建命令。

```powershell
swcl cloudflare/wrangler login                                                        #浏览器授权
swcl cloudflare/wrangler pages project create "<项目名>" --production-branch main       #创建项目
swcl cloudflare/wrangler pages deploy "$build" --project-name "<项目名>" --branch main  #发布到生产环境
```

上例把生产分支设为 `main`。已有项目使用其实际生产分支；其他分支名会生成预览部署。复制命令返回的网址，继续下面的线上检查。命令和项目行为见 [Cloudflare 上传说明](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

## 上传到 EdgeOne Makers

EdgeOne 上传产物时仍会读取其中的构建设置。打开本次 `$build` 目录中的 `edgeone.json`，只调整以下三个字段，保留响应头、重定向等其余内容：

```json
{
  "installCommand": "",
  "buildCommand": "",
  "outputDirectory": "."
}
```

这是修改片段，不是完整文件。不要用它覆盖整个 JSON，也不要把这些上传设置写回源码中的 Git 托管构建配置。每次重新构建后都要调整本次上传副本。

```powershell
swcl edgeone/cli login                                                        #浏览器授权
swcl edgeone/cli makers deploy "$build" -n "<项目名>" -e production --site global  #上传生产产物
```

选择与账号和项目一致的站点；上例为 `global`，中国站使用 `china`。不存在的项目可能由命令创建，执行前核对名称。新项目先完成生产部署，再使用 `-e preview` 部署预览。命令参数见 [EdgeOne CLI](https://pages.edgeone.ai/document/edgeone-cli)，上传副本要求见 [Banyan EdgeOne 说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/edgeone.md#built-asset-upload)。

## 线上检查与后续更新

```powershell
swban check/http/security "<正式网址>"  #检查线上响应头
```

打开线上首页、新文章和各语言入口，检查图片、导航与链接。确认页面使用自己的站名和域名，不再指向示例仓库。若更换了域名，更新 `baseURL` 后重新构建，不只修改 DNS。

以后修改内容时，重复构建、检查和上传。上传完成且确认无需回退后，可以删除本次临时产物目录；不要删除站点源码。关闭终端后，`$build` 和命令简称不再保留，下次从构建步骤重新开始。

## Git 托管构建

若选择平台自动构建，上传的是源码仓库，不使用上述产物上传命令。平台需要 Hugo、Go 和 Git；构建命令为 `hugo --minify --gc --cleanDestinationDir`，输出目录为 `public`。

部署源码应使用已发布的固定 Module 版本。按[版本维护](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/upgrade.md#change-the-version)处理本地 `replace`，避免云端找不到本机目录。平台 Hugo 版本应满足主题要求。

EdgeOne 还需先在本地构建，再运行 `swban deploy/edgeone/sync "$build"`，把生成的 Git 构建配置复制到站点根目录后提交。此处使用未改成上传模式的产物。该命令只同步配置，不上传；后续由平台从仓库执行构建。平台工具版本设置见 [Cloudflare Hugo](https://developers.cloudflare.com/pages/framework-guides/deploy-a-hugo-site/) 和 [EdgeOne Hugo](https://pages.edgeone.ai/document/hugo)。
