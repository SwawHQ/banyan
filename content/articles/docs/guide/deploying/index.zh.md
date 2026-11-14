---
title: 首次部署
date: 2026-11-14
lastmod: 2026-11-14
url: p/deploying/
description: 选择平台，构建和检查正式产物，再上传并检查线上页面。
weight: 3
---

先完成[开始使用](/zh/p/getting-started/)。本页的 PowerShell 命令从站点根目录运行，并使用该页定义的 `swban` 简称。引号中的 `<正式网址>` 是需要替换的占位符。

## 选择部署方式

| 方式 | 需要提供 | 适用情况 |
| --- | --- | --- |
| 本地构建后上传 | 检查通过的 HTML 和资源目录 | 先在本机完成构建，再发布 |
| Git 托管构建 | 站点源码仓库与平台构建配置 | 推送代码后由平台自动构建和发布 |

用 `swban help/zh deploy` 查看按平台和方式划分的准备专项。Banyan 提供静态站点构建、交付配置生成和检查；账号授权、云项目创建、上传及 Git 接入由 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) 的专项说明指导。

| 平台 | Banyan 提供的配置 | 平台操作说明 |
| --- | --- | --- |
| Cloudflare Pages | `_headers`、`_redirects` | [上传产物](https://github.com/SwawHQ/swaw-clouds/blob/main/skills/swaw-clouds/tasks/cloudflare/deploy/pages-upload/help.json) · [Git 托管构建](https://github.com/SwawHQ/swaw-clouds/blob/main/skills/swaw-clouds/tasks/cloudflare/deploy/pages-git/help.json) |
| EdgeOne Makers | `edgeone.json` 交付规则 | [上传产物](https://github.com/SwawHQ/swaw-clouds/blob/main/skills/swaw-clouds/tasks/edgeone/deploy/upload/help.json) · [Git 托管构建](https://github.com/SwawHQ/swaw-clouds/blob/main/skills/swaw-clouds/tasks/edgeone/deploy/git/help.json) |
| 其他静态托管、对象存储与 CDN | HTML、资源和浏览器端 SW 策略 | 按目标平台配置响应头、重定向和缓存；Banyan 暂不生成这些平台的专用配置 |

两种方式使用同一套源码。上传方式交付产物目录；Git 方式交付源码和构建参数。切换前，按对应专项核对平台是否允许复用原项目。

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

每条命令成功后再执行下一条。构建不加 `-D`；草稿不会发布。产物目录应包含 `index.html`、各语言页面与资源。Cloudflare 还应有 `_headers` 和 `_redirects`，EdgeOne 应有 `edgeone.json`；没有重定向规则时，`_redirects` 为空文件。

查看报告中的失败项和跳过项。代表页面检查不覆盖全部文章，仍需检查自己的首页、导航、图片、外链和新文章。启用 SW 后的专项检查见[浏览器检查](/zh/p/browser-regression/)。

## 发布构建产物

两个平台都使用检查通过的产物目录。Banyan 生成的 EdgeOne 配置只含交付规则，上传前无需再调整构建字段。

按上表的“上传产物”专项完成授权和发布，并提供 `$build` 的绝对路径。已有 Swaw Clouds 时可直接查看指导；尚未安装时先执行第一行：

```powershell
swban base/node/npx --yes skills add SwawHQ/swaw-clouds --skill swaw-clouds -y  #安装云平台 Skill
function swcl { & .\.agents\skills\swaw-clouds\swcl.cmd @args }                 #定义命令简称
swcl help/zh cloudflare/deploy/pages-upload                                   #查看 Pages 上传指导
swcl help/zh edgeone/deploy/upload                                            #查看 Makers 上传指导
```

## 线上检查与后续更新

```powershell
swban check/http/security "<正式网址>"  #检查线上响应头
```

打开线上首页、新文章和各语言入口，检查图片、导航与链接。确认页面使用自己的站名和域名，不再指向示例仓库。若更换了域名，更新 `baseURL` 后重新构建，不只修改 DNS。

以后修改内容时，重复构建、检查和上传。上传完成且确认无需回退后，可以删除本次临时产物目录；不要删除站点源码。关闭终端后，`$build` 和命令简称不再保留，下次从构建步骤重新开始。

## Git 托管构建

平台从关联的仓库分支拉取源码，不使用上述产物上传命令，也不需要安装或调用 `swban`。

| 构建设置 | Banyan 使用的值 |
| --- | --- |
| 根目录 | 站点在仓库中的目录；本参考站点为 `./` |
| 构建命令 | `hugo --minify --gc --cleanDestinationDir` |
| 输出目录 | `public` |
| 工具 | 满足主题要求的 Hugo Extended；Hugo Modules 还需要 Go 和 Git |

部署源码应使用已发布的固定 Module 版本。按[版本维护](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/upgrade.md#change-the-version)处理本地 `replace`，避免云端找不到本机目录。自有站点需要的安装步骤和环境变量也应交给平台配置。

Cloudflare Pages 使用构建产物中的交付文件。EdgeOne Makers 的 Git 构建则需要项目根目录的 `edgeone.json`：先在本地构建并检查，再复制配置并提交。

```powershell
Copy-Item -LiteralPath (Join-Path $build "edgeone.json") -Destination ./edgeone.json  #复制交付配置到站点根目录
```

只有采用 EdgeOne Git 构建的站点，才需要提交根目录 `edgeone.json`。交付规则仍在 `delivery.toml` 中维护，不手工编辑生成文件。配置包含响应头及 CSP，相关内容变化后应重新构建、复制并提交。平台与本地应使用一致的源码、工具版本及构建参数。

构建命令、输出目录和工具版本统一在平台设置；Banyan 不再将这些字段写入 `edgeone.json`。

仓库授权、项目关联、构建参数设置及触发方式见上表的“Git 托管构建”专项。发布后核对部署的提交版本，并执行本页的线上检查。
