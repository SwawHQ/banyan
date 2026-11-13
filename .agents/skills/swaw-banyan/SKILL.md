---
name: swaw-banyan
description: 协助用户应用、定制、开发-测试、检查-部署、乃至日常运维基于 Swaw Banyan Hugo Theme 的站点，自带 Hugo、Go、Git、gh（GitHub CLI）、Node/npm、Bun 等工具准备。
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
```
云平台 CLI 与授权使用独立的 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) 技能。
将其 `skills/swaw-clouds/` 安装到项目的 `.agents/skills/swaw-clouds/`。
Banyan 负责构建和检查；Swaw Clouds 负责云平台操作，上传使用构建产物的绝对路径。

交付配置修改 `assets/site/delivery.toml`；`_headers` 和 `edgeone.json` 由 Hugo 生成。
爬虫规则修改站点的 `assets/site/robots.txt.tmpl`；`enableRobotsTXT` 控制是否输出 `robots.txt`，参考站点默认开启。
所有页面由站点根 `content/` 维护；Module 只提供布局、脚本和样式。
Front matter 自定义字段统一放在 `params` 中；Hugo 原生字段保留顶层，继承默认值使用 `cascade.params`。模板仍通过 `.Params.<字段>` 读取自定义值。
`params.slots` 中，`breadcrumb` 启用面包屑导航；`meta` 统一启用文章元信息、章节目录和正文页的 BlogPosting；`[]` 全部关闭。
面包屑列由浏览器加载共享 `.txt` HTML 片段；根导航、栏目主列表和正文保留 HTML。
Powered by 使用 `page-article-norss`；公共模板按 `site-status` 和 `page-actions` 短代码在每页加载一次所需脚本。离线页使用独立的 `page-offline`，保留正文、主题和重试功能，不加载导航、SW 管理或预取脚本。
`page-article-rss` 可作为 RSS 条目；`page-article-norss` 保留相同正文功能，不作为 RSS 条目。栏目默认输出 HTML 和 RSS；`outputs: [HTML]` 仅关闭该栏目的订阅源。
集合布局使用 `_index.md`：`page-collection-directory-name-only` 只显示名称，`page-collection-directory` 显示目录信息，`page-collection-products` 显示产品信息。后两者的 `-all` 布局通过 `params.aggregate` 指定来源栏目。
`page-collection-wall` 用于普通栏目，混排直属子栏目、文章与引用；目录共用详情浮窗，父列保留紧凑导航。`page-collection-wall-all` 可用于首页和普通汇总栏目，通过 `params.aggregate` 指定来源；`params.wall` 通过 size.width/height 配置目标图片尺寸（一边可为 auto），通过 details 配置详情入口，通过 scroll 配置滚动方向。文章封面取包内 `cover.*` 或 `params.wall.cover`；目录封面取自身包内 `cover.*`，无封面时用独立 `description`（正文字号）；无独立说明时使用站点 `favicon.link.svg`，缺少时回退 `favicon.ico`，两者皆缺失则报错。排列配置仅向 section 级联。
公共导航路径的每级栏目都使用 `_index.md`，并输出 HTML。
`page-collection-directory-all` 的 `params.time_range` 按 Hugo `Lastmod` 筛选文章；手动子栏目接收各自时间范围内的文章，剩余文章留在父栏目，配置示例见 [安装说明](references/install.md)。
语言和外观设置使用 `_index.md`，布局分别为 `page-collection-language`、`page-collection-appearance`，并设置 `outputs: [HTML]`。
各语言设置页的 `params.language_icon` 提供该语言选项的图标；`params.icon` 提供设置页导航入口的图标。
外观设置页的 `params.appearance_icons` 分别声明 `auto`、`light`、`dark` 选项图标，沿用 SVG 名称、文字和图片格式。
各语言的站名和默认描述由对应首页的 `title`、`description` 提供；不在 `hugo.toml` 重复设置站名。页面可用自己的 `description` 覆盖默认描述。
`page-home` 宿主首页的 `params.show_navigation` 控制第一列导航，默认为 `true`；没有引用艺术包时也适用。首页正文用 `{{< home-art "/_res/home-art/wind" >}}` 引用艺术页。站点在 `content/_res/home-art/<主题>/` 维护隐藏叶子包：各语言的 `index.md` 保存正文和 `params`，CSS、JS 放在同一包内。艺术包的 `params.styles` 和 `params.scripts` 选择指纹外链资源。艺术包的 `params.template` 选择包内 `scene.html.tmpl`；场景计算、HTML、CSS 和 JS 均随包维护，新增场景无需修改 Module。模板上下文是艺术页，使用 `.Params`、`.Resources` 和 `.Content`；风场把 Markdown 正文放在场景后。资源模板不自动转义 HTML，文字和 HTML 属性值使用 `htmlEscape`。
最小示例位于 `content/_res/home-art/minimal/`，提供英、中、阿三语言、模板和 CSS，无需 JS。复制包、修改包内文件，再更新首页 `home-art` 引用即可；参考首页使用 `page-home` 和风场短代码，保留汇总来源与图片墙参数注释；启用图片墙时改用 `page-collection-wall-all`、取消 `aggregate` 与 `wall` 的注释并移除艺术短代码。
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
| 添加任务或编排站点测试套件 | [任务维护](references/tasks.md) |

托管构建使用平台自己的工具链；EdgeOne 任务只同步配置。
