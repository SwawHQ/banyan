---
title: 01 本地开发
date: 2026-11-06
lastmod: 2026-11-17
url: p/local-development/
description: 预览最小演示和文档站点，并按改动选择检查。
---

## 仓库结构

Banyan 仓库维护主题、Skill、源码测试、参考站点、使用指南、开发资料和版本说明。

```text
banyan/
├── hugo.toml, go.mod, go.sum              #站点配置和正式 Module 依赖
├── hugo.work                              #本地主题开发 workspace
├── swban, swban.cmd                       #站点根目录命令入口
├── content/articles/                      #正文、文章分类、文档和版本说明
├── content/articles/docs-*/              #七个文档栏目
├── content/articles/changelog/            #主题和 Skill 版本说明
├── content/articles-all/                  #文章汇总
├── content/products/                      #产品分类与一份引用
├── content/products-all/                  #产品汇总
├── content/{appearance,language,my,rss}/  #站点自有设置和说明页
├── assets/site/                           #站点品牌资源
├── assets/deploy/                         #部署开关、重定向与外部资源清单
├── i18n/                                  #界面字典
├── content/powered-by/                    #版本信息与预取诊断
├── module/                                #布局、脚本和样式，不含站点内容
├── .agents/skills/swaw-banyan/            #本地工具和通用检查任务
└── tests/                                 #主题和工具源码测试
```

根 `go.mod` 固定正式 Module 版本，`swban server` 和 `swban build` 默认加载该版本。修改主题时，在 Banyan 根目录用 `swban dev` 在本机预览，用 `swban dev/lan` 在局域网预览，或运行 `swban dev/build` 构建。这些命令通过 `hugo.work` 加载 `./module`。
站点定制留在各站点根目录，可复用主题行为放入 Banyan 的 `module/`。

## 预览

进入要预览的站点根目录。命令行支持 Windows x64、Linux x64 和 macOS x64/ARM64。
Windows 使用根目录 `.\swban.cmd`，Linux 和 macOS 使用 `sh ./swban`。
下文使用 `swban` 简称；定义方式和首次工具准备见[开始使用](/zh/p/getting-started/#取得站点)。
仅安装 Skill 的其他站点，使用 `.agents/skills/swaw-banyan/` 中对应平台的入口。

```text
swban server               #本机预览，启动时建立搜索索引
swban server/lan           #供局域网和手机预览
swban server/pagefind.off  #跳过搜索索引
swban server -p 13241      #指定端口
swban server -D=false      #不包含草稿
```

默认预览地址为 `http://127.0.0.1:5678/`。保存站点文件后，Hugo 会重新构建并刷新页面。
Windows 上若新增栏目后预览仍返回 404，可用 `swban server --poll 500ms` 启用文件轮询。开发本地主题时使用 `swban dev --poll 500ms`。
每次启动建立一次搜索索引，修改内容后需重启命令更新索引。预览产物写入站点的 `publishDir`（默认 `public/`），退出后保留。
`server/lan` 和 `dev/lan` 默认监听 `::`，系统支持时同时接收 IPv4。手机使用电脑的局域网地址和端口访问；可用 `--bind 0.0.0.0` 仅监听 IPv4。
追加的参数传给 Hugo，并覆盖对应默认值。启动日志显示实际命令，保留 Hugo 和 Pagefind 输出。
开发构建默认不压缩；若站点在开发环境也启用压缩，可用 `--minify=false` 关闭。
不需要在站点安装 npm 包。工具选择和依赖位置见
[Skill 使用说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/SKILL.md)。

## 构建与检查

下面使用的 `<build>`、缓存、资源和报告均放在系统临时目录的
`swaw/banyan/<task>/`。缓存和资源可通过 `HUGO_CACHEDIR` 和
`HUGO_RESOURCEDIR` 设置。完成后只清理本任务的过程文件，保留 CLI 固定目录与缓存。

```text
swban build --destination <build>       #生产构建与搜索索引
swban check/delivery <build>            #检查交付配置与发布路径
swban check/csp <build>                 #检查 CSP 和脚本完整性
swban check/sri <build>                 #检查资源 integrity
swban check/html/metadata <build>       #检查页面元数据
swban check/html/styles <build>         #检查样式契约
swban check/llms <build>                #检查 Agent 索引
swban report/size/html <build> --top 5  #报告最大 HTML 页面
swban report/size/assets <build>        #报告资源体积
```

按改动选择检查。检查违反契约时返回非零退出码；体积报告独立输出测量值。
产物任务默认读取 `public/`，第一个参数可指定其他目录。
安装或调整主题、工具后，运行 `swban doctor`；普通任务不检查版本配对。
内容字段和响应式图片检查读取 Hugo 解析后的配置。
用 `swban help` 查找任务，用 `swban <command>/help` 查看参数。

浏览器检查需要先运行 `swban base/browser/ensure`，见[浏览器检查](/zh/p/browser-regression/)。
源码测试和故障 fixture 留在 Banyan 仓库，见
[tests/README.md](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。
消费站点的业务文案、账号和专用路由预期留在各自仓库测试中。

## 同步与部署准备

```text
swban sync/resources                #同步全部外部资源
swban sync/resources <resource-id>  #按声明 id 同步外部资源
swban help/zh deploy          #查看各平台的部署准备方案
```

外部资源由站点的 `assets/deploy/external-resources.toml` 声明。运行 `swban sync/resources` 下载资源。若所选目标已存在，命令会报错。用 `swban sync/resources --force <resource-id>` 替换指定文件。
下载目标 `target` 相对站点根：全站资源放 `assets/site/`，正文资源放 `content/<页面>/` 内容包。
同步任务自带依赖，不需要站点执行 `npm install`。
EdgeOne 部署方式见
[EdgeOne 说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/edgeone.md)。

Banyan 参考站点部署在 `https://banyan.swaw.com/`；文档入口为
`https://banyan.swaw.com/articles/docs-start/`，版本说明入口为
`https://banyan.swaw.com/articles/changelog/`。构建时保留各站点自己的 `baseURL`。

## 下一步

参考站点运行后，阅读[02 项目结构与源码入口](/zh/p/partial-architecture/)，定位要修改的模块。
