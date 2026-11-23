---
title: 02 发布到 Cloudflare Pages
date: 2026-11-17
lastmod: 2026-11-17
url: p/cloudflare-pages/
description: 设置 Pages 交付配置，上传产物或连接 Git 仓库自动发布。
---

## 设置平台

编辑 `assets/deploy/settings.toml` 中已有的开关：

```toml
[platform]
cloudflare.pages.enabled = true
edgeone.makers.enabled = false
```

在 `hugo.toml` 中设置 `baseURL`，再选择一种发布方式。

| 方式 | 适用情况 |
| --- | --- |
| 上传产物 | 在本机或 CI 构建，再上传 |
| Git 托管构建 | 推送源码后自动构建和发布 |

准备长期使用 Git 自动发布时，直接创建 Git 集成项目。Direct Upload 项目改用 Git 集成需要新建项目。参见 [Pages 项目类型](https://developers.cloudflare.com/pages/configuration/git-integration/)。

## 上传产物

1. 按[构建和检查](/zh/p/deploying/#构建与检查)生成 `$build`。
2. 确认产物中包含 `_headers` 和 `_redirects`，与页面一起上传。
3. 在 Pages 控制台创建 Direct Upload 项目并上传产物目录，或按下面的命令使用 Wrangler。

控制台上传方式见 [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)。Windows x64 使用 Swaw Clouds 时，先完成[工具准备](/zh/p/deploying/#准备云平台工具)，再运行：

```powershell
swcl cloudflare/auth/setup                  #设置授权
swcl cloudflare/wrangler whoami              #核对账号
swcl cloudflare/wrangler pages project list  #列出项目
```

首次创建项目时，将 `<项目名>` 换成自己的名称。下例将 `main` 设为生产分支：

```powershell
swcl cloudflare/wrangler pages project create <项目名> --production-branch main  #创建上传项目
swcl cloudflare/wrangler pages deploy "$build" --project-name <项目名> --branch main  #发布生产版本
```

已有项目直接执行上传命令，并把 `--branch` 改为该项目的生产分支。其他分支发布为预览。Linux 和 macOS 可按官方 Direct Upload 文档使用原生 Wrangler。

## Git 托管构建

1. 按[准备 Git 源码](/zh/p/deploying/#准备-git-源码)整理仓库，并在本地完成构建检查。
2. 在 Pages 中创建 Git 集成项目，授权目标仓库，选择生产分支。
3. 在项目构建设置中填写下表。

| 设置 | 值 |
| --- | --- |
| 根目录 | 站点所在目录；参考站为 `./` |
| 构建命令 | `sh swban build --baseURL "$CF_PAGES_URL"` |
| 输出目录 | `public` |
| 构建镜像 | v3 |
| 环境变量 | `SKIP_DEPENDENCY_INSTALL=1` |

`swban` 会准备匹配的工具，并构建页面和搜索索引。平台提供的 `CF_PAGES_URL` 是本次部署网址；正式站使用固定域名时，将命令中的网址改为该域名。参见 [Pages 构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)和[构建镜像](https://developers.cloudflare.com/pages/configuration/build-image/)。

保存设置后触发构建。以后推送到关联分支，Pages 会按项目设置自动部署。Windows 的命令行管理步骤见：

```text
swcl help/zh cloudflare/deploy/pages-git  #查看仓库接入和构建设置
```

## 检查结果

在部署记录中确认环境、提交版本和访问地址，再按[线上检查](/zh/p/deploying/#发布后检查)检查页面和搜索。首次取得平台域名后，将它回填到 `baseURL`；上传方式需重新构建发布。

后续步骤见[绑定自有域名](/zh/p/custom-domain/)和[更新内容](/zh/p/publish-updates/)。
