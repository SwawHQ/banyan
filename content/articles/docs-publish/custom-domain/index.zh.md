---
title: 04 怎么更换站点网址？
date: 2026-11-17
lastmod: 2026-11-17
url: p/custom-domain/
description: 绑定自有域名，更新站点网址并重新发布。
---

## 在平台绑定域名

先在已部署的项目中添加目标域名，再按平台提示配置 DNS 和 HTTPS。

| 平台 | 操作入口 |
| --- | --- |
| Cloudflare Pages | 进入项目的 Custom domains，选择 Set up a domain |
| EdgeOne Makers | 进入项目的域名管理，添加自定义域名并完成所有权验证 |

Cloudflare Pages 使用根域名时，需要在同一账号接入该域名并使用 Cloudflare 名称服务器。使用子域名时，可在原 DNS 服务商添加指向项目 `pages.dev` 地址的 CNAME。先完成项目域名绑定，再配置解析。见[官方域名说明](https://developers.cloudflare.com/pages/configuration/custom-domains/)。

EdgeOne Makers 按控制台提供的记录完成所有权验证，再设置 CNAME；同时确认域名关联的部署环境和 HTTPS 状态。不同服务区域的接入条件见[官方域名说明](https://pages.edgeone.ai/document/custom-domain)。

## 更新站点配置

修改 `hugo.toml` 中已有的 `baseURL`：

```toml
baseURL = "https://www.example.com/"
```

把示例换成正式网址。部署到子路径时一并填写，例如 `https://www.example.com/blog/`。

Git 托管构建若在命令中传入 `--baseURL`，该参数会覆盖配置文件。同步更新命令中的网址；Cloudflare 正式构建使用固定域名时，也需调整原先的 `"$CF_PAGES_URL"`。

## 重新发布

按[构建和检查](/zh/p/deploying/)生成新产物，再按原部署方式发布。EdgeOne Git 项目同步生成的根目录交付配置，见[平台教程](/zh/p/edgeone-makers/#git-托管构建)。

需要继续接收旧域名访问时，保留旧域名及其 HTTPS 服务，在旧域名所属平台设置到新域名的跳转。单个路径迁移见[网址跳转](/zh/p/url-redirects/)。

## 检查结果

打开新域名的首页、文章和搜索页，检查图片、导航及各语言入口。查看页面的 canonical 地址、RSS 和 sitemap，确认使用新域名；再次访问旧域名，确认跳转符合预期。

```text
swban check/http/security "https://www.example.com/"  #检查新网址的响应头
```
