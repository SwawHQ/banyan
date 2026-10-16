---
title: 本地开发
slug: local-development
description: 预览本仓库，构建文档站点，并按改动选择检查。
weight: 1
---

## 仓库结构

仓库根目录是文档站点，也是本地主题 Module 的使用方。

```text
banyan/
├── hugo.toml, go.mod           #文档站点配置
├── content/docs/              #使用指南和开发资料
├── content/changelog/         #主题和 Skill 变更记录
├── data/                      #站点数据
├── module/                    #发布的 Hugo Module 和默认文件
├── .agents/skills/swaw-banyan/ #本地工具和检查任务
└── tests/                     #主题和工具源码测试
```

根 `go.mod` 使用 `replace ... => ./module`，因此预览不需要已发布的 Module。
站点定制留在根目录，可复用主题行为放入 `module/`。

## 预览

克隆仓库后进入根目录。下文 `swban` 代表
`.\.agents\skills\swaw-banyan\swban.cmd`，使用时按路径调用。
命令行目前支持 Windows x64。

```text
swban ensure                                                   #准备 Bun 或 Node
swban git.ensure                                               #准备 Git
swban go.ensure                                                #准备 Go
swban hugo.ensure                                              #准备 Hugo
swban hugo server -D --disableFastRender --port 13241            #预览站点
```

打开 `http://127.0.0.1:13241/`。Hugo 监听本地 Module，模板和资源变化会触发重建。
开发构建默认不压缩；若站点在开发环境也启用压缩，可用 `--minify=false` 关闭。
不需要在站点安装 npm 包。工具选择和依赖位置见
[Skill 使用说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/SKILL.md)。

## 构建与检查

下面使用的 `<build>` 应为系统临时目录，完成检查后清理。
缓存和资源也放在临时目录；可通过 `HUGO_CACHEDIR` 和 `HUGO_RESOURCEDIR` 设置。

```text
swban hugo --minify --noBuildLock --destination <build>  #生产构建
swban check/delivery <build>                            #检查交付配置与发布路径
swban check/csp <build>                                 #检查 CSP 和脚本完整性
swban check/sri <build>                                 #检查资源 integrity
swban check/html/metadata <build>                       #检查页面元数据
swban check/html/styles <build>                         #检查样式契约
swban check/llms <build>                                #检查 Agent 索引
swban report/size/html <build> --top 5                  #报告最大 HTML 页面
swban report/size/assets <build>                        #报告资源体积
```

按改动选择检查。检查违反契约时返回非零退出码；体积报告独立输出测量值。
产物任务默认读取 `public/`，第一个参数可指定其他目录。
内容字段和响应式图片检查读取 Hugo 解析后的配置，需要已准备的 Hugo、Go 和 Git。
用 `swban help` 查找任务，用 `swban <command> --help` 查看参数。

浏览器检查需要先运行 `swban ensure/browser`，见[浏览器检查](/zh/docs/development/browser-regression/)。
源码测试和故障 fixture 见 [tests/README.md](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。
消费站点的业务文案、账号和专用路由预期留在各站点测试中。

## 同步与部署准备

```text
swban sync/ext                       #同步全部外部资源
swban sync/ext wsl-distribution-info  #按声明 id 同步外部资源
swban deploy/edgeone/sync <build>     #复制生成配置到站点根目录
```

外部资源由站点的 `data/external-resources.yaml` 声明；演示站点默认为空列表。
同步任务自带依赖，不需要站点执行 `npm install`。
EdgeOne 同步默认读取 `public/`，只复制配置，不构建或上传。
Skill 尚未提供上传命令。部署方式见
[EdgeOne 说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/edgeone.md)。

文档站点的部署地址为 `https://banyan.swaw.com/`。
构建部署产物时使用该 `baseURL`，其他站点使用自己的地址。
