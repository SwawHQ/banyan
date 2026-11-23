---
title: 交付配置
date: 2026-11-06
lastmod: 2026-11-17
url: p/delivery/
description: 配置部署平台、HTTP 响应头、Service Worker 缓存和重定向。
---

## 配置来源

在 `assets/deploy/settings.toml` 选择部署平台、SW 模式及预取开关。本站跳转规则放在可选的 `assets/deploy/redirects.toml`。Module 的 `assets/deploy/policy.toml` 提供按顺序匹配的缓存路由、预取档位及内容检查间隔。需要定制时，将整份策略复制到站点同路径后编辑。各语言共用这些配置。

## 部署平台

初次发布按[构建和检查](/zh/p/deploying/)设置平台、构建并上传。本页只说明交付配置的含义。

`platform.cloudflare.pages.enabled` 控制 Cloudflare Pages 输出；`platform.edgeone.makers.enabled` 控制 EdgeOne Makers 输出。启用后分别生成 `_headers` 或 `edgeone.json`，有重定向规则时还会生成对应配置。

构建命令、输出目录和工具版本在平台设置；Banyan 生成的 EdgeOne 配置只包含响应头和重定向。两种部署方式的准备步骤见[构建和检查](/zh/p/deploying/)。

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
EdgeOne Makers 按声明顺序合并匹配规则。同名响应头取最后一次声明的值，其他响应头保留。将 `/*` 写在前面，再写 `/sw.js`、`/sw-version.json` 和指纹资源的例外规则。
CSP 根据实际内联脚本生成，详见[安全策略与 CSP](/zh/p/security-csp/)。

## Service Worker

启用和停用步骤见[离线访问](/zh/p/offline-access/)。`sw.mode` 选择运行方式：

| mode | 效果 |
| --- | --- |
| `off` | 不启用 SW，也不清理访客已经安装的 SW |
| `enable` | 启用缓存与离线回退 |
| `disable` | 访客再次访问时注销本站 SW，清理受管缓存 |

每条路由的 `sw.bucket` 选择缓存方式：

| sw.bucket | 用途 |
| --- | --- |
| `versioned` | 保存页面等随站点版本更新的资源；切换版本后清理旧缓存 |
| `fingerprinted` | 保存网址带内容指纹的资源，供多个构建版本复用 |
| `off` | 不进入 SW 缓存，仍可使用浏览器的 HTTP 缓存 |

命中缓存策略的同源 GET 请求先读取 SW 缓存。多条 SW 路由匹配时，最后声明者优先；仅含 HTTP 配置的路由不改变 SW 策略。不要把内容会变化但网址固定的文件放入指纹缓存桶。

HTTP 缓存与 SW 缓存分别配置。SW 命中不按 HTTP 的 `max-age` 自动过期；版本缓存未命中时重新验证 HTTP 缓存。预取是独立开关，见[预取配置](/zh/p/prefetch-stacks/)。

修改 SW 源码时，参见[Service Worker 回归](/zh/p/service-worker-regression-checklist/)。

## 重定向

`[[redirects]]` 声明 `source`、`destination` 和 `status`，与缓存路由分别配置。规则按声明顺序输出到启用的平台。添加步骤和发布后检查见[网址跳转](/zh/p/url-redirects/)。
