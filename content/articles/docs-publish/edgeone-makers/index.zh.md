---
title: 03 发布到 EdgeOne Makers
date: 2026-11-17
lastmod: 2026-11-17
url: p/edgeone-makers/
description: 设置 Makers 交付配置，上传产物或连接 Git 仓库自动发布。
---

## 设置平台

编辑 `assets/site/delivery.toml` 中已有的开关：

```toml
[platform]
cloudflare.pages.enabled = false
edgeone.makers.enabled = true
```

在 `hugo.toml` 中设置正式网址 `baseURL`。选择本地构建后上传，或连接 Git 仓库自动发布。

## 上传产物

1. 按[构建和检查](/zh/p/deploying/#构建与检查)生成 `$build`。
2. 确认产物目录根部包含 `index.html` 和生成的 `edgeone.json`。
3. 在 Makers 控制台选择直接上传，或使用下方 Swaw Clouds 命令上传整个产物目录。

Windows x64 先完成[工具准备](/zh/p/deploying/#准备云平台工具)，再核对账号：

```powershell
swcl edgeone/auth/setup        #设置授权
swcl edgeone/cli whoami --json  #核对身份与工作区
```

在目标项目的工作目录执行上传。下例为新项目选择海外区域，首次发布到生产环境：

```powershell
swcl edgeone/cli makers deploy "$build" -n <项目名> -e production -a overseas --skip-ai-gateway-sync --json  #发布静态站点
```

已有上传项目使用原项目名和区域。新项目完成首次生产部署后，可将环境改为 `preview` 发布预览。Banyan 生成的 `edgeone.json` 只含交付规则，直接随产物上传。

其他系统可通过控制台上传；平台入口见 [Makers 文档](https://pages.edgeone.ai/document)。

## Git 托管构建

1. 按[准备 Git 源码](/zh/p/deploying/#准备-git-源码)整理仓库，并在本地完成构建检查。
2. 将本次产物中的 `edgeone.json` 复制到站点根目录并提交。
3. 在 Makers 中导入仓库，授权访问并选择部署分支。
4. 在平台中设置构建参数，保存后触发部署。

Windows（PowerShell）：

```powershell
Copy-Item -LiteralPath (Join-Path $build "edgeone.json") -Destination ./edgeone.json  #复制交付规则
```

Linux 和 macOS：

```sh
cp "$build/edgeone.json" ./edgeone.json  #复制交付规则
```

| 设置 | 值 |
| --- | --- |
| 根目录 | 站点所在目录；参考站为 `./` |
| 安装命令 | `true`，工具由构建命令准备 |
| 构建命令 | `sh swban build` |
| 输出目录 | `public` |

`swban build` 同时构建页面和搜索索引。构建日志中应有 Hugo 和 Pagefind 的完成记录。平台支持自定义安装、构建命令和输出目录，见 [Makers 构建指南](https://pages.edgeone.ai/document/build-guide)。

Makers 从项目根目录读取 `edgeone.json`。交付规则仍在 `assets/site/delivery.toml` 中维护；规则、脚本或 CSP 变化后，重新构建并复制生成文件。本地和平台使用相同源码、工具版本和构建参数，以保持 CSP 一致。配置位置见 [edgeone.json 说明](https://pages.edgeone.ai/document/edgeone-json)。

构建参数统一在平台设置。Git 仓库接入步骤见[导入仓库](https://pages.edgeone.ai/document/importing-a-git-repository)，Windows 命令行指导见：

```text
swcl help/zh edgeone/deploy/git  #查看仓库接入和构建设置
```

## 检查结果

在部署记录中核对提交版本、环境和地址，等待部署成功，再按[线上检查](/zh/p/deploying/#发布后检查)检查页面、搜索和响应头。平台默认域名的访问条件以项目控制台为准。

后续步骤见[绑定自有域名](/zh/p/custom-domain/)和[更新内容](/zh/p/publish-updates/)。
