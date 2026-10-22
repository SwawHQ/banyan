---
title: 交付与缓存
url: p/delivery/
description: 配置部署平台、HTTP 响应头、Service Worker 缓存和重定向。
---

## 配置来源

在站点的 `data/delivery.toml` 中设置交付策略，Module 默认文件为
`module/data/delivery.toml`。Hugo 按顶层字段替换，嵌套表不继承遗漏字段。
修改某个表时复制完整的顶层表；站点声明 `routes` 后会替换整个默认数组，
`routes = []` 表示清空。运行时配置应用到所有语言。

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

声明 `platform` 会替换所有平台设置；未列出的平台被关闭。
Cloudflare Pages 启用时生成 `_headers` 和 `_redirects`；
EdgeOne Makers 启用时生成 `edgeone.json`。
EdgeOne 的 `hugoVersion` 默认来自构建所用的 Hugo 版本，也可在平台表中指定。
修改源配置，不直接编辑生成文件。

托管构建使用平台自己的 Hugo、Go 和 Git，不安装 Skill。
本地构建、检查与 EdgeOne 配置同步见[本地开发](/zh/p/local-development/)。

## 路由和 HTTP 响应头

通用规则在前，例外在后。以下只展示路由格式；编辑站点时保留所需的全部默认路由：

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

SW 默认关闭。启用时完整填写顶层表：

```toml
[service_worker]
mode = "enable"
content_check_interval = 5
offline_notice_path = "offline/"
```

`content_check_interval` 单位为分钟。`mode = "disable"` 生成清理 worker，
由客户端注销本站 SW 并清除受管缓存；`off` 不加载管理逻辑，不会自动注销已有 SW。

仅 `mode = "enable"` 会生成 `sw.js` 和 `sw-version.json`。后者的 `version`
是内容版本，Powered by 的本站构建区域显示同一次构建的值。
SW 在成功导航后延迟 15 秒检查版本，并受 `content_check_interval` 的最小间隔限制；
发现新版本后切换内容缓存。此内容版本与 SW 程序本身的哈希不同。

| `sw.bucket` | 行为 |
| --- | --- |
| `versioned` | 当前构建缓存，版本切换后删除旧缓存 |
| `fingerprinted` | 跨构建复用内容指纹 URL |
| `off` | 交给浏览器请求，不进入 SW 缓存 |

两种缓存均对同源 GET 请求先读 SW 缓存。多条 SW 规则匹配时，最后声明者优先。
仅含 HTTP 的路由不改变 SW 策略；未匹配请求不进入 SW 缓存。
默认 `/*` 包括页面、JSON 和 XML，可用后续 `off` 规则排除路径。

缓存缺失时，`versioned` 校验 HTTP 缓存，`fingerprinted` 保留普通 HTTP 缓存行为。
页面查询参数归一化和离线 HTML 回退由 worker 处理。
关联资源预热只选指纹 URL，其他版本资源在请求时缓存。
HTTP 响应头与 SW 策略独立配置，不互相推导。

启用 SW 时，`sw-policy.json` 按实际匹配顺序复制路径和 bucket，第一条命中者优先。
`off` 和 `disable` 不生成该副本。预取独立开关，见[预取配置](/zh/p/prefetch-stacks/)。

## 重定向

站点 URL 迁移放入 `data/redirects.toml`，与缓存策略分开：

```toml
[[rules]]
source = "/old-path/"
destination = "/new-path/"
status = 301
```

启用的平台分别生成 EdgeOne `edgeone.json` 条目和 Cloudflare `_redirects`。
用 `swban check/delivery <build>` 检查产物；范围和限制见 Skill 的
[交付检查](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/delivery.md)。
