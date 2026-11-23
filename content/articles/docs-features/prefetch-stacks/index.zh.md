---
title: 预取：怎么提前加载页面？
date: 2026-11-06
lastmod: 2026-11-17
url: p/prefetch-stacks/
description: 开启页面预取，选择预取强度并检查效果。
---

页面预取会提前请求链接目标，缩短后续访问的等待时间，也会增加流量。参考站默认关闭。

## 启用预取

1. 打开 `assets/deploy/settings.toml`。
2. 在已有 `[prefetch]` 中将 `enabled` 改为 `true`。
3. 保留现有图标规则，按需要调整档位。

```toml
[prefetch]
enabled = true
```

要调整预取档位，将 Module 的 `assets/deploy/policy.toml` 复制到站点同路径，编辑其中的规则。

```toml
[prefetch]
default = "conservative"
```

`default` 用于未匹配图标规则的链接。参考站对 `folder` 图标另有设置，修改 `default` 后这些设置仍生效。

## 调整强度

| 档位 | 使用方式 |
| --- | --- |
| `off` | 关闭此规则的预取 |
| `conservative` | 等待明确交互 |
| `moderate` | 增加悬停触发 |
| `eager` | 更早预取，含触屏可见链接 |
| `immediate` | 页面初始化后批量预取 |

浏览器原生机制决定具体触发时机；SW 和 link 机制的触发条件见[预取配置](/zh/p/prefetch-rules/#配置)。

例如，把文件夹入口的尾列从 `eager` 调整为 `moderate`，修改已有项：

```toml
[prefetch]
icons.folder.tail = "moderate"
```

参考配置还对尾列文件夹启用预渲染。只需预取页面 HTML 时，将已有的 `prerender.icons.folder.tail` 改为 `"off"`。图标和列范围的含义见[配置参考](/zh/p/prefetch-rules/#图标与列范围)。

## 检查结果

重新构建并发布，在当前语言的 Powered by 页面展开“更多诊断信息”，查看所选机制和配置。浏览器可能根据网络和资源情况跳过预取。需要进一步检查时，按[诊断说明](/zh/p/prefetch-rules/#诊断)操作。

关闭时，将 `prefetch.enabled` 改回 `false` 后重新部署。预取与[离线访问](/zh/p/offline-access/)分别控制。
