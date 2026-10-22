# Banyan

[English](README.md) · 简体中文

一个网站模板（Hugo 主题），用于对资源、文章做分类，提供米勒列（Miller columns）导航。


[演示](https://banyan.swaw.com/) ·
[文档](https://banyan.swaw.com/zh/docs) ·
[变更记录](content/changelog/_index.md)


**1.** 米勒列导航

**2.** 多层、多维分类

**3.** 文章、工具列表视图

**4.** 配套 Agent Skill，自动部署腾讯 EdgeOne pages、Cloudflare pages，自动日常运维

**5.** 纯静态部署、资源指纹与 CDN 缓存

**6.** 多语言、主题切换、自定义外观

**7.** PWA、SW 缓存、页面预取

**8.** 自动生成 CSP 与 SRI

**9.** RSS、社交元数据、sitemap、robots.txt、llms.txt




## 开始使用

下载并解压本仓库，在仓库根目录用 PowerShell 执行（Windows x64）：

```powershell
.\.agents\skills\swaw-banyan\swban.cmd base/hugo server -D --disableFastRender --port 13241  #启动预览
```

入口会按需准备 Node/npm、Git、Go 和 Hugo：优先复用兼容工具，缺少时自动下载。
GitHub CLI 在使用 `base/gh` 时准备。
`base/uv/python` 按需准备隔离的 Python 环境；`base/uv tool run` 运行 Python CLI。
使用方法见 [Python 工具](.agents/skills/swaw-banyan/references/python.md)。
`deploy/cloudflare/` 提供 cf 和 Wrangler，按需准备固定版本。
使用方法见 [Cloudflare 工具](.agents/skills/swaw-banyan/references/cloudflare.md)。
`deploy/tencent/cli` 提供 tccli，自动准备 uv/Python 和独立工具环境。
使用方法见 [腾讯云工具](.agents/skills/swaw-banyan/references/tencent.md)。
`swban deploy/auth/setup` 打开 Cloudflare 和腾讯云共用的授权页。
打开 <http://127.0.0.1:13241/> 查看站点。

安装到自己的站点，见[开始使用](content/docs/guide/getting-started/index.zh.md)；
构建和检查，见[本地开发](content/docs/development/local-development/index.zh.md)。


## 文档

指南目前以中文提供。

- [站点配置](content/docs/guide/site-configuration/index.zh.md)
- [列表与分类](content/docs/guide/collection-lists/index.zh.md)
- [页面区域](content/docs/guide/layout-slots/index.zh.md)
- [交付与缓存](content/docs/guide/delivery/index.zh.md)
- [安全策略与 CSP](content/docs/guide/security-csp/index.zh.md)
- [站点发现与来源链接](content/docs/guide/discovery/index.zh.md)
- [Web App Manifest 与图标](content/docs/guide/web-app/index.zh.md)
- [开发与发布指南](content/docs/development/_index.zh.md)

## 许可证

[MIT 许可证](LICENSE)  
Copyright (c) 2026 WY Swaw LLC (https://swaw.com, https://github.com/SwawHQ)

