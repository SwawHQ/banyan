---
name: swaw-banyan
description: 协助用户应用、定制、开发-测试、检查-部署、乃至日常运维基于 Swaw Banyan Hugo Theme 的站点，自带 Hugo、Go、Git、gh（GitHub CLI）、Node/npm、Bun、uv/Python、cloudflare cli(cf)/wrangler、tencent tccli 准备。
license: MIT
metadata:
  version: "0.1.0"
  module: "github.com/SwawHQ/banyan/module"
---


技能安装目录应存在`swban.cmd`命令入口，目前支持 Windows x64。


```text
swban doctor [目录]       #检查工具和站点主题
swban help                #查看常用命令
swban help/zh 1           #查看一级分类
swban help/zh check 2     #查看 check 下两层命令
swban <command> --help    #查看参数和默认值
swban deploy/cloudflare/wrangler pages deploy <build-path> --project-name <name> --branch preview  #发布 Pages 预览
```
Cloudflare 操作先读 [Cloudflare 工具](references/cloudflare.md)。`<build-path>` 使用绝对路径。
腾讯云操作先读 [腾讯云工具](references/tencent.md)。

云 CLI 子进程使用系统临时目录下固定的 `swaw/banyan/wrangler/`、
`swaw/banyan/cf/` 和 `swaw/banyan/tccli/`，保留目录及缓存。
`swban` 自身保留调用目录；云 CLI 的文件和目录参数使用绝对路径。
Wrangler 项目使用原生 `--cwd <绝对项目路径>`。

交付配置修改 `assets/site/delivery.toml`；`_headers` 和 `edgeone.json` 由 Hugo 生成。
爬虫规则修改站点的 `assets/site/robots.txt.tmpl`；`enableRobotsTXT` 控制是否输出 `robots.txt`，参考站点默认开启。
所有页面由站点根 `content/` 维护；Module 只提供布局、脚本和样式。
Front matter 自定义字段统一放在 `params` 中；Hugo 原生字段保留顶层，继承默认值使用 `cascade.params`。模板仍通过 `.Params.<字段>` 读取自定义值。
`params.slots` 中，`breadcrumb` 启用路径导航；`meta` 统一启用文章元信息、章节目录和正文页的 BlogPosting；`[]` 全部关闭。
Powered by 和离线页使用 `page-article-norss`；公共模板按 `site-update` 和 `page-actions` 短代码在每页加载一次所需脚本。
`page-article-rss` 可作为 RSS 条目；`page-article-norss` 保留相同正文功能，不作为 RSS 条目。栏目默认输出 HTML 和 RSS；`outputs: [HTML]` 仅关闭该栏目的订阅源。
集合布局直接绑定字段和行为：`page-collection` 只显示名称，`page-collection-directory` 显示目录信息，`page-collection-products` 显示产品信息。后两者的 `-all` 布局通过 `params.aggregate` 指定来源栏目。
`page-collection-directory-all` 的 `params.time_range` 按 Hugo `Lastmod` 筛选文章；手动子栏目接收各自时间范围内的文章，剩余文章留在父栏目，配置示例见 [安装说明](references/install.md)。
语言和外观设置使用 `_index.md`，布局分别为 `page-collection-language`、`page-collection-appearance`，并设置 `outputs: [HTML]`。
各语言的默认描述由对应首页的 `description` 提供；页面可用自己的 `description` 覆盖。
`page-home` 宿主首页的 `params.show_navigation` 控制第一列导航，默认为 `true`；没有引用艺术包时也适用。首页正文用 `{{< home-art "/_res/home-art/wind" >}}` 引用艺术页。站点在 `content/_res/home-art/<主题>/` 维护隐藏叶子包：各语言的 `index.md` 保存正文和 `params`，CSS、JS 放在同一包内。艺术包的 `params.styles` 和 `params.scripts` 选择指纹外链资源。风场正文使用 `{{< home-art/wind/scene >}}`，文字和场景参数也放在该页的 `params`。Module 提供短代码模板与计算模板；站点可用 `layouts` 下的同路径文件覆写。
第一列默认显示首页和已发布的直属子页。内部页放在 `content/_res/`，公开 URL 使用 `_res/…`；共用的 `_index.md` 统一隐藏其导航和站点发现入口。
界面字典放在 `assets/i18n/`，由项目 `hugo.toml` 挂载到 Hugo 的 `i18n`。


## 根据改动选择检查

- 修改交付配置或资源发布路径后，运行 `check/delivery`。
- 修改脚本或安全响应头后，运行 `check/csp`。
- 浏览器检查从 `check/browser/site <build>` 开始，准备方式和测试页面要求见
  [浏览器检查](references/browser-site.md)。默认使用 Chromium；
  涉及内核差异时，选择已有的 `.webkit` 检查。
- 站点特有的文案、账号、路由和业务预期留在站点测试中。

按改动选择检查，参数见任务的 `--help`。报告失败项和跳过的检查范围。

## 参考文档

只读取当前任务需要的参考文档：

| 任务 | 参考文档 |
| --- | --- |
| 调整环境诊断检查和修复提示 | [诊断配置](references/doctor.toml) |
| 安装或升级 Module | [安装说明](references/install.md) |
| 执行浏览器检查，包括 SW 更新 | [浏览器检查](references/browser-site.md) |
| 检查交付产物和指纹发布路径 | [交付检查](references/delivery.md) |
| 用 `sync/ext` 下载已声明的外部资源 | [外部资源](references/external-resources.md) |
| 同步生成的 EdgeOne 配置或规划部署 | [EdgeOne](references/edgeone.md) |
| 准备 Cloudflare CLI、登录、发布静态站和管理资源 | [Cloudflare 工具](references/cloudflare.md) |
| 准备 tccli、调用腾讯云或 EdgeOne API | [腾讯云工具](references/tencent.md) |
| 使用隔离的 Python 环境和 CLI | [Python 工具](references/python.md) |
| 添加任务或编排站点测试套件 | [任务维护](references/tasks.md) |

托管构建使用平台自己的工具链；EdgeOne 任务只同步配置。
