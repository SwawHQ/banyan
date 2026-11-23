# Swaw Banyan

[English](README.md) · 简体中文

**Finder 风格的 Hugo 建站模板，用米勒列与多维分类组织知识库、文档与目录。**

像榕树一样多维分枝、一文多归；零前端框架，纯静态输出，并随包提供 AI Agent 运维工具链。

[参考站点与文档（banyan.swaw.com）](https://banyan.swaw.com/) ·
[应用展示（swaw.com）](https://swaw.com/)

## 核心特性

### 1. 多维结构与多视图浏览
- **多维分类**：用栏目层级与 `_map.toml` 栏目文章引用将同一篇正文收录到多个分类，保持唯一规范网址，并在浏览时保留文章浏览来源与导航排序状态。
- **多种视图**：提供 Finder 风格的米勒列导航、文章列表、产品列表、按时间范围汇总的列表，以及支持网格、瀑布流和等高排列的图片墙。
- **多语言与外观定制**：内置多语言与 RTL 排版、浅色/深色模式、配色方案切换与首页艺术包。

### 2. 交付级静态工程
- **轻量快速**：Hugo 预生成静态页面，零前端框架、零外部字体，内置 Pagefind 全文搜索。
- **缓存、离线与预取**：在 `assets/deploy/settings.toml` 选择部署平台、SW 模式和预取开关。Module 提供缓存路由和预取规则。
- **安全与双平台交付**：构建期自动生成内联脚本 SHA-256 CSP 与 SRI，同时输出 Cloudflare Pages（`_headers`、`_redirects`）与腾讯云 EdgeOne Makers（`edgeone.json`）配置。
- **内容发现与 AI 友好**：内置 RSS、JSON-LD 结构化数据、社交分享图、sitemap、`robots.txt` 与 `llms.txt`。

### 3. AI Agent 协同运维
- **零环境折腾**：根目录 `swban` / `swban.cmd` 按需校验并准备跨平台本地工具（Windows x64、Linux x64、macOS x64/ARM64），无需手动安装 Hugo、Go、Node 或 Pagefind。
- **随包 Skill**：内置 `swaw-banyan` Skill，覆盖预览、构建、CSP/交付检查、浏览器回归测试与版本升级；可另行配合 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) 完成云端部署。

Banyan 专注静态内容发布与边缘交付；账号、支付、评论等后端能力需另行接入。

## 快速开始（可交由 AI Agent 协助）

1. 从[最新正式版本](https://github.com/SwawHQ/banyan/releases/latest)下载 **Source code (zip)**，解压作为站点目录。

2. 在站点根目录启动本地预览（支持 Windows x64、Linux x64、macOS x64/ARM64）：

   Windows（PowerShell）：
   ```powershell
   .\swban.cmd server      #预览草稿并建立搜索索引
   .\swban.cmd server/lan  #局域网设备预览
   .\swban.cmd build       #构建正式站点与搜索索引
   ```

   Linux 与 macOS：
   ```sh
   sh ./swban server      #预览草稿并建立搜索索引
   sh ./swban server/lan  #局域网设备预览
   sh ./swban build       #构建正式站点与搜索索引
   ```

   命令入口会按需准备本地工具。打开终端显示的网址即可预览；修改内容后重启 `server` 更新搜索索引。Linux 需具备 `sh`、基础系统工具、`curl`、`tar` 和 `sha256sum`，macOS 直接使用系统自带工具。详情见[开始使用](content/articles/docs-start/getting-started/index.zh.md)。

3. 定制为自己的站点：

   保留以下核心文件与目录：
   ```text
   hugo.toml                    #站点配置
   go.mod、go.sum               #固定的 Banyan 主题版本与校验和
   swban、swban.cmd             #站点命令入口
   .agents/skills/swaw-banyan/  #随包提供的 Swaw Banyan Skill
   assets/deploy/               #部署开关与网址重定向
   assets/site/                 #品牌资源与外部资源清单
   i18n/                        #界面字典
   content/                     #站点页面内容
   ```

   以下示例与主题源码目录可按需移除或替换：
   ```text
   module/                         #主题源码，使用正式 Module 时可移除
   hugo.work                       #本地主题 workspace，使用正式 Module 时可移除
   content/articles/changelog/     #Banyan 变更记录
   content/articles/docs-*/        #Banyan 文档
   content/articles/product-info/  #示例产品说明
   content/products/               #示例产品分类与引用
   content/products-all/           #示例产品列表
   ```

   移除文档或变更记录后，同步更新首页与 Powered by 页面的对应链接，再修改站点名称、域名、图标和文章内容。

4. 部署上线：

   - **Linux / macOS 或手动部署**：参考[首次部署](content/articles/docs-publish/deploying/index.zh.md)，使用 Git 托管构建或上传构建产物。
   - **Windows x64（AI Agent 协同部署）**：在站点根目录安装 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) Skill：

     ```powershell
     .\swban.cmd base/node/npx --yes skills add SwawHQ/swaw-clouds --skill swaw-clouds -y  #安装云部署 Skill
     ```

     用 AI Agent 打开站点根目录，按目标平台发出指令：

     Cloudflare Pages：
     ```text
     使用 .agents/skills/swaw-banyan 在本地构建并检查站点，再使用 .agents/skills/swaw-clouds 部署到 Cloudflare Pages。
     需要授权时，运行 .\.agents\skills\swaw-clouds\swcl.cmd auth/setup，提示我在授权管理界面录入凭据。
     ```

     腾讯云 EdgeOne Makers：
     ```text
     使用 .agents/skills/swaw-banyan 在本地构建并检查站点，再使用 .agents/skills/swaw-clouds 的 edgeone/cli 部署到 EdgeOne Makers。
     需要授权时，运行 .\.agents\skills\swaw-clouds\swcl.cmd edgeone/cli login，引导我完成官方登录。
     ```

     域名购买、DNS 解析，以及 Cloudflare 与 EdgeOne Makers 混合部署（通过 DNS-ECS 将中国大陆流量路由至 EdgeOne Makers），同样可交给 Agent 完成。手动打开授权界面可运行：

     ```powershell
     .\.agents\skills\swaw-clouds\swcl.cmd auth/setup  #打开云平台授权管理界面
     ```

## 升级已有站点

1. 查看 [Changelog](https://banyan.swaw.com/zh/articles/changelog/) 确认目标版本。
2. 用 AI Agent 打开站点根目录，输入：

   ```text
   使用 .agents/skills/swaw-banyan，先通过根目录入口（Windows 用 .\swban.cmd；Linux/macOS 用 sh ./swban）运行 help upgrade/git 查看升级步骤，再将当前站点升级到 Banyan 官方最新发布版。保留本站内容、URL 和自定义项；遇到需要确认的改动先报告再执行。
   ```

## 开发 Banyan 主题

在仓库中保留 `module/` 与 `hugo.work`。以下使用[本地开发指南](content/articles/docs-dev/local-development/index.zh.md)中的 `swban` 简称：

```text
swban dev        #用本地主题源码预览改动
swban dev/build  #用本地主题源码构建站点
swban server     #用 go.mod 固定版本预览
swban build      #用 go.mod 固定版本构建
```

## 文档索引

- [项目术语表](content/articles/docs-reference/glossary/index.zh.md)
- [开始使用](content/articles/docs-start/getting-started/index.zh.md)
- [站点配置](https://banyan.swaw.com/zh/p/site-configuration/)
- [列表与产品](https://banyan.swaw.com/zh/p/collection-lists/)
- [页面区域](https://banyan.swaw.com/zh/p/layout-slots/)
- [交付与缓存](https://banyan.swaw.com/zh/p/delivery/)
- [安全策略与 CSP](https://banyan.swaw.com/zh/p/security-csp/)
- [站点发现与来源链接](https://banyan.swaw.com/zh/p/discovery/)
- [Web App Manifest 与图标](https://banyan.swaw.com/zh/p/web-app/)
- [开发与发布指南](https://banyan.swaw.com/zh/articles/docs-dev/)

## 许可证

[MIT 许可证](LICENSE)  
Copyright (c) 2026 WY Swaw LLC (https://swaw.com)
