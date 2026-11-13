---
name: swaw-banyan
description: 协助安装、定制、开发、测试和部署基于 Swaw Banyan Hugo Theme 的站点，并准备所需的本地工具。
license: MIT
metadata:
  version: "0.1.0"
  module: "github.com/SwawHQ/banyan/module"
---

# Swaw Banyan

使用本技能目录中的 `swban.cmd`；以下命令简称为 `swban`。目前支持 Windows x64。

```text
swban doctor [目录]       #检查工具和站点主题
swban help                #查看常用命令
swban help/zh 1           #查看一级分类
swban help/zh check 2     #查看 check 下两层命令
swban <command> --help    #查看参数和默认值
```

## 站点与 Module 的边界

- 站点在根目录的 `content/` 维护全部页面，在 `assets/site/` 维护配置与品牌资源，在 `assets/i18n/` 维护界面字典。Module 提供布局、脚本和样式，不提供站点内容与配置的默认副本。
- Hugo 原生 front matter 字段保留在顶层。自定义字段放在 `params` 中，继承默认值放在 `cascade.params` 中；模板通过 `.Params` 读取自定义字段。
- 公共导航路径的每级栏目都使用 `_index.md`，并输出 HTML。内部页放在 `content/_res/`，由共用 `_index.md` 隐藏其导航和站点发现入口。
- 面包屑列由浏览器加载共享的 `.txt` HTML 片段；根导航、栏目主列表和正文保留在页面 HTML 中。
- 修改交付规则时，编辑 `assets/site/delivery.toml`；`_headers` 和 `edgeone.json` 是 Hugo 生成的产物。

## 根据任务读取说明

只读取当前任务需要的文档。页面布局和功能参数不在本入口重复列出。

| 任务 | 参考文档 |
| --- | --- |
| 安装站点或接入 Module | [安装说明](references/install.md) |
| 升级、降级或测试本地 Module | [版本维护](references/upgrade.md) |
| 修改根配置、语言或内部页面 | [站点配置](references/site-configuration.md) |
| 修改首页或制作 home-art 艺术包 | [首页与艺术包](references/home-art.md) |
| 配置图片墙、封面和滚动方式 | [图片墙](references/content.md#image-walls) |
| 修改站名、描述或爬虫规则 | [站点信息与发现](references/site-configuration.md#site-identity-and-discovery) |
| 配置栏目、汇总、时间范围、RSS 或页面 slots | [栏目与文章布局](references/content.md#collections-and-article-layouts) |
| 修改语言或外观设置页 | [设置页](references/site-configuration.md#language-and-appearance-pages) |
| 调整环境诊断检查和修复提示 | [诊断配置](references/doctor.toml) |
| 执行浏览器检查，包括 SW 更新 | [浏览器检查](references/browser-site.md) |
| 修改 SW 状态或预取诊断页面 | [状态与诊断页](references/diagnostics.md) |
| 配置交付策略或检查产物与指纹路径 | [交付检查](references/delivery.md) |
| 用 `sync/ext` 下载已声明的外部资源 | [外部资源](references/external-resources.md) |
| 同步生成的 EdgeOne 配置或规划部署 | [EdgeOne](references/edgeone.md) |
| 添加任务或编排站点测试套件 | [任务维护](references/tasks.md) |

## 根据改动选择检查

- 修改交付配置或资源发布路径后，运行 `check/delivery`。
- 修改脚本或安全响应头后，运行 `check/csp`。
- 浏览器检查从 `check/browser/site <build>` 开始，准备方式和测试页面要求见浏览器检查文档。默认使用 Chromium；涉及内核差异时，选择已有的 `.webkit` 检查。
- 站点特有的文案、账号、路由和业务预期留在站点测试中。

参数见各任务的 `--help`。报告失败项和跳过的检查范围。

## 云端部署

Banyan 负责构建和检查。云平台 CLI、授权及上传由独立的 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) 技能负责；将其 `skills/swaw-clouds/` 安装到项目的 `.agents/skills/swaw-clouds/`。上传时使用构建产物的绝对路径。

托管构建使用平台自己的工具链；Banyan 的 EdgeOne 任务只同步配置。
