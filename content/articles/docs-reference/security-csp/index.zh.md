---
title: 安全策略与 CSP
date: 2026-11-06
lastmod: 2026-11-14
url: p/security-csp/
description: 保留 CSP 所需配置，接入自定义脚本并检查部署响应头。
---

## 生成与配置

Banyan 为已启用的平台生成 CSP 响应头，并为外链脚本提供完整性信息。站点根 `hugo.toml` 须保留：

```toml
[minify]
disableJS = true
```

此设置防止 HTML 压缩再次改写脚本，使 CSP 哈希失效。

其他缓存、安全和权限头在 `assets/site/delivery.toml` 中维护。修改源配置后重新构建，不直接编辑生成的 `_headers` 或 `edgeone.json`。平台开关和路由见[交付与缓存](/zh/p/delivery/)。

参考配置的 Permissions-Policy 关闭主题不需要的高权限能力。HSTS 使用 `max-age=300`，不包含 `includeSubDomains` 或 `preload`；是否扩大范围由站点决定。

## 自定义脚本

自定义模板中的裸内联 JS 不会自动获得 CSP 授权，优先使用外链脚本。新增第三方脚本或改变资源来源后，检查实际页面和部署响应头。

主题的内联脚本与原生预取规则由构建统一生成哈希，无需添加 `unsafe-inline`。预取配置见[预取配置](/zh/p/prefetch-stacks/)。

## 验证

```text
swban check/delivery <build>                  #检查交付配置与指纹发布路径
swban check/csp <build>                       #检查哈希、integrity 和响应头
swban check/browser/csp <build> --page <path>  #检查浏览器实际 CSP 违规
swban check/http/security <url>               #检查已部署的响应头
```

部署后可用真实 HTTP 响应验证线上 CSP。检查范围和准备步骤见[浏览器检查](/zh/p/browser-regression/)及 Skill 的[交付检查](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/delivery.md)。
