---
title: 安全策略与 CSP
url: p/security-csp/
description: 配置发布响应头，管理内联脚本与原生规则的 CSP 哈希。
---

## 生成与配置

Hugo 生成 HTML，并为已启用的平台生成 `_headers` 或 `edgeone.json`。
主题 JS 由 `js.Build` 构建；
生产构建使用 esbuild 压缩。站点根 `hugo.toml` 须保留：

```toml
[minify]
disableJS = true
```

`entry-baseof/inline-scripts.html` 返回内联脚本的最终正文，
`system-delivery/deployment/csp-value.html` 从同一份正文计算 SHA-256。
HTML 压缩不能再次改写 JS，否则 CSP 哈希失效。

## 脚本边界

内联入口位于 `module/assets/js/inline/`：

- `theme-boot.js` 同步首帧主题。
- `breadcrumb-pending.js`、`breadcrumb-skeleton.js` 预留路径列。
- `root-navigation.js` 同步根入口选中状态。
- `canvas-position.js` 保存和恢复横向画幅。

新增内联脚本须在 `entry-baseof/inline-scripts.html` 注册，并使用其返回正文。
自定义模板中的裸内联 JS 不会自动获得授权；优先使用外链 JS。
页面差异通过 `data-*` 或 JSON 提供。`application/json` 和
`application/ld+json` 数据块不纳入可执行 JS 哈希。
更新面板用 `textContent` 呈现页面文案，不把文案写入 HTML。

## 策略来源

默认 HTML 策略由 `system-delivery/deployment/csp-value.html` 声明，
可执行内联 JS 使用哈希授权。外链 JS 提供 integrity。
`/*.xml` 使用 cache policy 中的独立 CSP，允许 RSS/XSL 样式。

其他缓存、安全和权限头来自 `module/data/delivery.toml`；
站点可用 `data/delivery.toml` 按顶层字段替换。修改路由时填写完整的
`routes` 数组；修改平台时填写完整的 `platform` 表。
`platform.cloudflare.pages.enabled` 控制 `_headers` 和 `_redirects`，
`platform.edgeone.makers.enabled` 控制 `edgeone.json`。修改源配置，不手改生成产物。
默认 Permissions-Policy 关闭主题不需要的高权限能力。
HSTS 默认 `max-age=300`，不包含 `includeSubDomains` 或 `preload`；
扩大范围属于站点部署决策。

## 验证

```text
swban check/delivery <build>                   #检查交付配置与指纹发布路径
swban check/csp <build>                        #检查哈希、integrity 和响应头
swban check/browser/csp <build> --page <path>  #检查浏览器实际 CSP 违规
swban check/http/security <url>                #检查已部署的响应头
```

静态 CSP 检查覆盖最终 HTML、已生成的部署头文件和 XML 策略。
交付检查读取生成产物，不读取源 TOML 或重算资源内容哈希；缺少的渠道报告未检查。
浏览器本地服务器使用该构建的 Cloudflare 响应头。部署后还需检查真实 HTTP 响应，
尤其是 EdgeOne 重叠规则的处理结果。
浏览器范围见[浏览器检查](/zh/p/browser-regression/)，源码 fixture 见
[tests/README.md](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。

## Speculation Rules

原生 document rules 静态内联到 HTML。其精确正文与可执行内联脚本一样，
通过 CSP 哈希许可；不增加 `unsafe-inline`。
构建和检查都使用压缩后的最终正文。

规则先等待导航和排序，再等待前端选中原生机制。
选择 SW 或 link 时，原生选择器保持关闭。
不支持原生规则时，前端选择可用的 SW 或 link。

使用 `prefetch/rules`、`prefetch/overlap` 和 `prefetch/debug`
检查规则解析、单机制发送和诊断行为。
配置与边界见 [prefetch-stacks.md](/zh/p/prefetch-stacks/)。
