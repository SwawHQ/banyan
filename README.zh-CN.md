# Banyan

[English](README.md) · 简体中文

**一个网站模板兼 Hugo 主题，强调分类、无数据库、边缘原生。**


[演示站点 1](https://banyan.swaw.com/) ·
[演示站点 2](https://swaw.com/)

特性：

**1.** 可对资源/文章做多维、多层分类

**2.** 卡片墙、米勒列导航、产品列表、文章列表

**3.** 多语言、主题切换、外观/首页可自定义

**4.** 配套 Agent Skill，跨云部署、运维、运营——可直接托管给你的本地 Agent

**5.** Hugo 预生成页面 + CDN 缓存优化 + 边缘计算 + 对象存储，无需数据库和自托管服务器

**6.** PWA、Service Worker 缓存、页面预取、自动生成 CSP/SRI

**7.** RSS、社交元数据、sitemap、robots.txt、llms.txt

账号系统、支付、评论等后端功能暂不提供，正在开发。




## 设置新站点（可让 AI Agent 协助）


1. 从[最新正式版本](https://github.com/SwawHQ/banyan/releases/latest)下载 **Source code (zip)**，解压后作为你的站点目录。

2. 在站点根目录启动本地预览。Banyan 支持 Windows x64、Linux x64 和 macOS x64/ARM64。

    Windows（PowerShell）：
    ```powershell
    .\swban.cmd dev  #预览草稿并建立搜索索引
    ```

    Linux 和 macOS：
    ```sh
    sh ./swban dev  #预览草稿并建立搜索索引
    ```

    根目录入口按需准备工具。打开终端显示的网址。修改内容后，重启 `dev` 更新搜索索引。用 `dev/lan` 供局域网预览，用 `build` 构建正式站点和搜索索引。

    Linux 需有 sh、基础系统工具、curl、tar、sha256sum；macOS 使用系统自带工具。工具准备和 `swban` 命令简称见[开始使用](content/articles/docs-start/getting-started/index.zh.md)。

3. 检查目录中这四项，以了解站点结构：
    ```
    hugo.toml
    archetypes/
    assets/
    content/
    ```

    这些资源可按需删除或替换：
    ```
    content/articles/changelog/  #Banyan 更新记录
    content/articles/docs-*/     #Banyan 文档
    content/articles/product-info/  #Banyan 产品说明，可替换为自己的产品
    content/products/themes/   #网站主题，通过 _map.toml 收录产品说明
    content/products/            #产品分类的根目录
    content/products-all/        #产品列表的根目录
    ```

    然后设置你自己的站点名称、域名、Logo 和文章。


4. 部署\
    随仓库附带的 [Swaw Clouds](https://github.com/SwawHQ/swaw-clouds) Skill 目前支持 Windows x64。Linux 和 macOS 可使用 [Git 托管构建，或通过托管平台工具上传产物](content/articles/docs-publish/deploying/index.zh.md)。

    Windows 用户在站点根目录用 PowerShell 安装该 Skill：
    ```powershell
    .\swban.cmd base/node/npx --yes skills add SwawHQ/swaw-clouds --skill swaw-clouds -y  #安装部署 Skill
    ```

    用你的 AI Agent 打开站点根目录，提示：
    ```
    使用 .agents/skills/swaw-banyan 在本地构建并检查站点，再使用 .agents/skills/swaw-clouds 部署到 Cloudflare Pages。
    需要授权时，运行 .\.agents\skills\swaw-clouds\swcl.cmd auth/setup，提示我在授权管理界面录入凭据。
    ```

    腾讯云 EdgeOne Makers：
    ```
    使用 .agents/skills/swaw-banyan 在本地构建并检查站点，再使用 .agents/skills/swaw-clouds 的 edgeone/cli 部署到 EdgeOne Makers。
    需要授权时，运行 .\.agents\skills\swaw-clouds\swcl.cmd edgeone/cli login，引导我完成官方登录。
    ```

    域名购买、域名解析、或混合使用 Cloudflare 与 EdgeOne Makers，并将中国大陆流量通过 DNS-ECS 路由到 EdgeOne Makers……也都可以提示 Agent 去完成。

    手动打开授权管理界面：
    ```powershell
    .\.agents\skills\swaw-clouds\swcl.cmd auth/setup
    ```


## 已有基于 banyan 的站点，要升级
1. 先查看：[Changelog](https://banyan.swaw.com/zh/articles/changelog/)，确定要升级到哪个版本，这里假设是要最新发布版。

2. 用你的 AI Agent 打开站点根目录，提示：
    ```
    使用 .agents/skills/swaw-banyan，先通过根目录入口（Windows 用 .\swban.cmd；Linux/macOS 用 sh ./swban）运行 help upgrade/git 查看升级步骤，再将当前站点升级到 Banyan 官方最新发布版。保留本站内容、URL、自定义项；不能明确处置的内容，先报告并等待确认。
    ```



## 文档


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

