# Banyan Security and CSP

## 生成与配置

Hugo 生成 HTML、`_headers` 和 `edgeone.json`。主题 JS 由 `js.Build` 构建；
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

其他缓存、安全和权限头来自 `module/data/banyan/delivery.toml`；
站点可用 `data/delivery.toml` 覆盖。修改源配置，不手改生成产物。
默认 Permissions-Policy 关闭主题不需要的高权限能力。
HSTS 默认 `max-age=300`，不包含 `includeSubDomains` 或 `preload`；
扩大范围属于站点部署决策。

## 验证

```text
swban check/csp <build>                        #检查哈希、integrity 和响应头
swban check/browser/csp <build> --page <path>  #检查浏览器实际 CSP 违规
swban check/http/security <url>                #检查已部署的响应头
```

静态检查覆盖最终 HTML、两种部署头文件的一致性和 XML 策略。
浏览器检查使用该构建的实际响应头。部署后还需检查真实 HTTP 响应。
浏览器范围见[浏览器检查](browser-regression.md)，源码 fixture 见
[tests/README.md](../tests/README.md)。

## Speculation Rules

`speculation_rules.mode = "header"` 通过响应头交付指纹化的
document rules JSON，不在运行时注入可执行内联脚本。
不支持该能力的浏览器会忽略该头，runtime/SW 预取按自己的配置执行。

两栈在 `independent` 模式命中同一 slot 时，Hugo 输出 overlap warning；
`panicOnWarning=true` 会使构建失败。使用 `prefetch/rules`、
`prefetch/overlap` 和 `prefetch/debug` 检查生成、协调和诊断行为。
配置与边界见 [prefetch-stacks.md](prefetch-stacks.md)。
