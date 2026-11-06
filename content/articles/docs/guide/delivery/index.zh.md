---
title: 交付与缓存
date: 2026-11-06
lastmod: 2026-11-06
url: p/delivery/
description: 配置部署平台、HTTP 响应头、Service Worker 缓存和重定向。
---

## 配置来源

站点根 `assets/site/delivery.toml` 是交付策略的唯一来源，须保留完整文件。
新站点从 Banyan 根参考站点取得该文件；已有站点按参考文件补齐配置，
保留自己的 SW、路由和平台值。Module 和传统主题目录不提供默认配置，
不再合并或继承 Module 中的配置。`routes` 按声明顺序使用，
`routes = []` 表示不声明缓存路由。运行时配置应用到所有语言。

## 部署平台

```toml
[platform.cloudflare.pages]
enabled = true

[platform.edgeone.makers]
enabled = true
installCommand = ""
buildCommand = "hugo --minify --gc --cleanDestinationDir"
outputDirectory = "public"
nodeVersion = "22.11.0"
```

在站点完整配置中声明各平台和 `enabled` 开关；未列出的平台关闭。
Cloudflare Pages 启用时生成 `_headers` 和 `_redirects`；
EdgeOne Makers 启用时生成 `edgeone.json`。
EdgeOne 的 `hugoVersion` 默认来自构建所用的 Hugo 版本，也可在平台表中指定。
修改源配置，不直接编辑生成文件。

托管构建使用平台自己的 Hugo、Go 和 Git，不安装 Skill。
本地构建、检查与 EdgeOne 配置同步见[本地开发](/zh/p/local-development/)。

## 路由和 HTTP 响应头

通用规则在前，例外在后。以下只展示路由格式；编辑站点时保留所需的全部路由：

```toml
[[routes]]
path = "/*"
http.headers.Cache-Control = "public, max-age=900, must-revalidate"
sw.bucket = "versioned"

[[routes]]
path = "/js/*"
http.headers.Cache-Control = "public, max-age=31536000, immutable"
http.cloudflare.pages.unset = ["Cache-Control"]
sw.bucket = "fingerprinted"

[[routes]]
path = "/sw.js"
sw.bucket = "off"
```

`path` 可为精确路径，或在任意位置包含一个 `*`，例如 `/*.xml`。
通配符可匹配空字符串，也可跨越 `/`。
SW 匹配区分大小写的 URL pathname，保留百分号编码，不含查询参数和片段；
非 ASCII 路径使用编码形式。

`http.headers` 应用于两个平台。同一路由的
`http.cloudflare.pages.headers` 和 `http.edgeone.makers.headers` 覆盖通用值。
Cloudflare 的 `unset` 在设置当前值前移除此前匹配的响应头。
HTTP 路由保留声明顺序，由各平台按自己的规则处理。
CSP 根据实际内联脚本生成，详见[安全策略与 CSP](/zh/p/security-csp/)。

## Service Worker

Banyan 根参考配置关闭 SW。启用时在站点配置中完整填写此表：

```toml
[sw]
mode = "enable"
content_check_interval = 5
offline_notice_path = "_res/offline/"
```

SW 为 `enable` 时，每种已启用语言都必须发布 `offline_notice_path` 指向的 HTML 页面，
根参考站点的 `content/_res/offline/` 提供这些页面；`off` 和 `disable` 允许缺少离线页。

`content_check_interval` 单位为分钟。`mode = "disable"` 生成清理 worker，
由客户端注销本站 SW 并清除受管缓存；`off` 不加载管理逻辑，不会自动注销已有 SW。

`mode = "enable"` 生成正常程序 `sw.js` 和内容版本 `sw-version.json`；
后者是一个 JSON 字符串，与 Powered by 的本站构建区域使用同一次构建的版本。
`disable` 生成清理程序 `sw.js`，不生成内容版本文件。
达到 `content_check_interval` 最小间隔后，受管导航立即在后台检查内容版本，
不等待导航成功，也不阻塞导航响应。并发导航共用一次检查。发现新版本后切换后续请求的缓存，
不刷新已打开页面。此内容版本与 SW 程序本身的哈希不同。

| `sw.bucket` | 行为 |
| --- | --- |
| `versioned` | 当前构建缓存，版本切换后删除旧缓存 |
| `fingerprinted` | 跨构建复用内容指纹 URL |
| `off` | 交给浏览器请求，不进入 SW 缓存 |

两种缓存均对同源 GET 请求先读 SW 缓存。多条 SW 规则匹配时，最后声明者优先。
仅含 HTTP 的路由不改变 SW 策略；未匹配请求不进入 SW 缓存。
参考配置的 `/*` 包括页面、JSON 和 XML，可用后续 `off` 规则排除路径。

缓存缺失时，`versioned` 校验 HTTP 缓存，`fingerprinted` 保留普通 HTTP 缓存行为。
导航缓存保留真实查询参数；URL 片段不进入请求。离线 HTML 回退由 worker 处理。
关联资源预热只选指纹 URL，其他版本资源在请求时缓存。
HTTP 响应头与 SW 策略独立配置，不互相推导。

启用 SW 时，`sw-policy.json` 按实际匹配顺序复制路径和 bucket，第一条命中者优先。
`off` 和 `disable` 不生成该副本。预取独立开关，见[预取配置](/zh/p/prefetch-stacks/)。

## 重定向

站点 URL 迁移使用 `assets/site/delivery.toml` 顶层的 `[[redirects]]` 数组，
与 `routes` 缓存规则分别声明。没有重定向时省略该数组。
Banyan 参考文件只提供注释示例；需要时取消注释并填写站点值：

```toml
# [[redirects]]
# source = "/old-path/"
# destination = "/new-path/"
# status = 301
```

启用的平台按声明顺序生成 EdgeOne `edgeone.json` 条目和 Cloudflare `_redirects`。
用 `swban check/delivery <build>` 检查产物；范围和限制见 Skill 的
[交付检查](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/delivery.md)。
