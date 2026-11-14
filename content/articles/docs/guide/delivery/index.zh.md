---
title: 交付与缓存
date: 2026-11-06
lastmod: 2026-11-14
url: p/delivery/
description: 配置部署平台、HTTP 响应头、Service Worker 缓存和重定向。
---

## 配置来源

站点根 `assets/site/delivery.toml` 是站点交付配置的唯一来源，须保留完整文件。
新站点从 Banyan 根参考站点取得该文件；已有站点按参考文件补齐配置，
保留自己的 SW、路由和平台值。Module 和传统主题目录不提供默认配置，
`routes` 按声明顺序使用，
`routes = []` 表示不声明缓存路由。运行时配置应用到所有语言。

## 部署平台

初次发布按[首次部署](/zh/p/deploying/)设置平台、构建并上传。本页只说明交付配置的含义。

`platform.cloudflare.pages.enabled` 控制 Cloudflare Pages 输出；`platform.edgeone.makers.enabled` 控制 EdgeOne Makers 输出。启用后分别生成 `_headers` 或 `edgeone.json`，有重定向规则时还会生成对应配置。

构建命令、输出目录和工具版本在平台设置；Banyan 生成的 EdgeOne 配置只包含响应头和重定向。两种部署方式的准备步骤见[首次部署](/zh/p/deploying/)。

## 路由和 HTTP 响应头

通用规则在前，例外在后。以下只展示路由格式；修改已有的对应路由，不要用示例替换整个文件。保留本站需要的安全头和其他路由：

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

SW 用于缓存与离线访问。第一次部署可先不启用，确认普通页面正常后再配置。在已有 `[sw]` 表中选择模式：

| mode | 效果 |
| --- | --- |
| `off` | 不启用 SW，也不清理访客已经安装的 SW |
| `enable` | 启用缓存与离线回退 |
| `disable` | 访客再次访问时注销本站 SW，清理受管缓存 |

当前参考文件使用 `disable`，并关闭预取。要启用 SW，修改已有字段，例如：

```toml
[sw]
mode = "enable"
content_check_interval = 5
offline_notice_path = "_res/offline/"
```

此例每隔至少 5 分钟，在后续页面导航时检查内容版本。每种已启用语言都要有对应 HTML 离线页，参考站的 `content/_res/offline/` 已提供三种语言。修改离线说明后重新构建、检查和部署。

新内容版本会影响后续请求，不自动刷新已打开页面。站点构建版本默认随构建生成；如果自行设置 `params.build.version`，每次内容发布都要更新它。状态可在 Powered by 页面查看。

每条路由的 `sw.bucket` 选择缓存方式：

| sw.bucket | 用途 |
| --- | --- |
| `versioned` | 保存页面等随站点版本更新的资源；切换版本后清理旧缓存 |
| `fingerprinted` | 保存网址带内容指纹的资源，供多个构建版本复用 |
| `off` | 不进入 SW 缓存，仍可使用浏览器的 HTTP 缓存 |

同源 GET 请求先读取 SW 缓存。多条 SW 路由匹配时，最后声明者优先；仅含 HTTP 配置的路由不改变 SW 策略。不要把内容会变化但网址固定的文件放入指纹缓存桶。

HTTP 缓存与 SW 缓存分别配置。SW 命中不按 HTTP 的 `max-age` 自动过期；版本缓存未命中时重新验证 HTTP 缓存。预取是独立开关，见[预取配置](/zh/p/prefetch-stacks/)。

停用已上线的 SW 时，发布 `disable` 模式，并检查访客再次访问后的清理行为。直接改为 `off` 不会移除旧 SW。专项检查见[Service Worker 检查](/zh/p/service-worker-regression-checklist/)。

## 重定向

站点 URL 迁移使用 `assets/site/delivery.toml` 顶层的 `[[redirects]]` 数组，
与 `routes` 缓存规则分别声明。没有重定向时省略该数组。
将下列示例追加为顶层规则，替换为本站的新旧路径：

```toml
[[redirects]]
source = "/old-path/"
destination = "/new-path/"
status = 301
```

启用的平台按声明顺序生成 EdgeOne `edgeone.json` 条目和 Cloudflare `_redirects`。
用 `swban check/delivery <build>` 检查产物；范围和限制见 Skill 的
[交付检查](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/delivery.md)。
