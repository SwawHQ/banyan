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
├── hugo.toml, go.mod                      #最小演示配置
├── swban, swban.cmd                       #站点根目录命令入口
├── content/articles/                      #正文、文章分类、文档和版本说明
├── content/articles/docs-*/              #七个文档栏目
├── content/articles/changelog/            #主题和 Skill 版本说明
├── content/articles-all/                  #文章汇总
├── content/products/                      #产品分类与一份引用
├── content/products-all/                  #产品汇总
├── content/{appearance,language,my,rss}/  #站点自有设置和说明页
├── assets/site/                           #站点资源和交付配置
├── assets/i18n/                           #由项目挂载的界面字典
├── content/powered-by/                    #版本信息与预取诊断
├── content/_res/                          #离线页和首页艺术包
├── module/                                #布局、脚本和样式，不含站点内容
├── .agents/skills/swaw-banyan/            #本地工具和通用检查任务
└── tests/                                 #主题和工具源码测试
```

Banyan 根 `go.mod` 使用 `replace ... => ./module`，直接读取随仓库提供的主题源码，无需先发布 Module。其他站点可用本地 `replace` 指向这份源码。
站点定制留在各站点根目录，可复用主题行为放入 Banyan 的 `module/`。
独立站点发布时通常固定 Module 版本。完整仓库随附的 `./module` 可参与托管构建；指向仓库外目录的本地替换路径则不可用。

## 预览

进入要预览的站点根目录。命令行支持 Windows x64、Linux x64 和 macOS x64/ARM64。
Windows 使用根目录 `.\swban.cmd`，Linux 和 macOS 使用 `sh ./swban`。
下文使用 `swban` 简称；定义方式和首次工具准备见[开始使用](/zh/p/getting-started/#取得站点)。
仅安装 Skill 的其他站点，使用 `.agents/skills/swaw-banyan/` 中对应平台的入口。

```text
swban dev               #本机预览，启动时建立搜索索引
swban dev/lan           #供局域网和手机预览
swban dev/pagefind.off  #跳过搜索索引
swban dev -p 13241      #指定端口
swban dev -D=false      #不包含草稿
```

默认打开 `http://127.0.0.1:5678/`。Hugo 监听本地 Module，模板和资源变化会触发完整重建和浏览器刷新。
每次启动建立一次搜索索引，修改内容后需重启命令更新索引。开发产物使用独立临时目录，退出后清理，不覆盖 `public/`。
`dev/lan` 默认监听 `::`，系统支持时同时接收 IPv4。手机使用电脑的局域网地址和端口访问；可用 `--bind 0.0.0.0` 仅监听 IPv4。
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
用 `swban help` 查找任务，用 `swban <command> --help` 查看参数。

浏览器检查需要先运行 `swban base/browser/ensure`，见[浏览器检查](/zh/p/browser-regression/)。
源码测试和故障 fixture 留在 Banyan 仓库，见
[tests/README.md](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。
消费站点的业务文案、账号和专用路由预期留在各自仓库测试中。

## 同步与部署准备

```text
swban sync/ext                #同步全部外部资源
swban sync/ext <resource-id>  #按声明 id 同步外部资源
swban help/zh deploy          #查看各平台的部署准备方案
```

外部资源由站点的 `assets/site/external-resources.yaml` 声明；演示站点默认为空列表。
下载目标 `target` 相对站点根：全站资源放 `assets/site/`，正文资源放 `content/<页面>/` 内容包。
同步任务自带依赖，不需要站点执行 `npm install`。
EdgeOne 部署方式见
[EdgeOne 说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/edgeone.md)。

Banyan 参考站点部署在 `https://banyan.swaw.com/`；文档入口为
`https://banyan.swaw.com/articles/docs-start/`，版本说明入口为
`https://banyan.swaw.com/articles/changelog/`。构建时保留各站点自己的 `baseURL`。

## 下一步

参考站点运行后，阅读[02 项目结构与源码入口](/zh/p/partial-architecture/)，定位要修改的模块。
