# Banyan

[English](README.md) · 简体中文

一个网站模板（Hugo 主题），用于对资源、文章做分类浏览，提供米勒列（Miller columns）导航。


[演示](https://banyan.swaw.com/) ·
[文档](https://banyan.swaw.com/zh/docs) ·
[变更记录](content/changelog/_index.md)


**1.** 米勒列导航

**2.** 多层、多维分类

**3.** 文章、工具列表视图

**4.** 配套 Agent Skill

**5.** 纯静态部署、资源指纹与 CDN 缓存

**6.** 多语言、主题切换、自定义外观

**7.** PWA、SW 缓存、页面预取

**8.** 自动生成 CSP 与 SRI

**9.** RSS、社交元数据、sitemap、robots.txt、llms.txt




## 开始使用

下载并解压本仓库，在仓库根目录用 PowerShell 执行（Windows x64）：

```powershell
.\.agents\skills\swaw-banyan\swban.cmd git.ensure                                       #准备 Git 和 JS 运行时
.\.agents\skills\swaw-banyan\swban.cmd go.ensure                                        #准备 Go
.\.agents\skills\swaw-banyan\swban.cmd hugo.ensure                                      #准备 Hugo
.\.agents\skills\swaw-banyan\swban.cmd hugo server -D --disableFastRender --port 13241  #启动预览
```

准备命令会复用兼容工具，缺少时自动下载。打开 <http://127.0.0.1:13241/> 查看站点；
后续预览只需执行最后一条命令。

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
Copyright (c) 2026 WY Swaw LLC  https://swaw.com

