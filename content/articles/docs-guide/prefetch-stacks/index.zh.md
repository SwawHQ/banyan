---
title: 运行 · 预取配置
date: 2026-11-06
lastmod: 2026-11-15
url: p/prefetch-stacks/
description: 按图标和列范围设置预取强度，并检查所选预取机制。
---

预取设置由站点完整的 `assets/site/delivery.toml` 提供，应用到所有语言。
首次部署可以保持关闭。需要启用时，在已有 `[prefetch]` 表中把 `enabled` 改为 `true`，再按下方说明调整规则；不要追加重复的表。
Module 不提供默认配置；未单独配置的图标和范围按本站表中的规则取值。预取按条目主图标名称和列范围匹配。

## 图标与列范围

`folder` 表示集合入口策略，`file` 表示内容页面策略。
这些名称是预取提示；更换条目图标也会改变策略。
只匹配条目的主 SVG 图标，正文装饰图标不参与图标分类。
未配置图标、文字、图片和其他页面链接使用 `default`。

| 范围 | 含义 |
| --- | --- |
| `root` | 根导航，第 0 列 |
| `tail` | 最后的条目列；集合页为主集合列表，文章页为最右面包屑列表 |
| `"root+N"` | 从根导航向右 N 个条目列 |
| `"tail-N"` | 从尾列向左 N 个条目列 |
| `all` | 此图标未被其他范围覆盖的条目链接 |

只计算导航和集合条目列。文章正文、章节和元信息不参与编号。
横向滚动不改变编号。没有面包屑列的文章页，根导航同时是尾列。
偏移到根导航时可匹配它，超出实际列数时不匹配。
偏移键统一加引号；`+` 不能用于 TOML 裸键。

重叠优先级固定为：`root > tail > tail-N > root+N > all > default`。
例如三列页面的 `root+1` 和 `tail-1` 指向同一列，使用 `tail-1`。
两端的明确配置优先；显式 `off` 阻止回落，配置声明顺序不影响结果。
基础预取为 `off` 的链接不参与预渲染。

## 配置

```toml
[prefetch]
enabled = true
default = "conservative"

[prefetch.icons.folder]
all = "conservative"
root = "moderate"
tail = "eager"
"tail-1" = "moderate"
# 需要按左侧深度配置时，可追加：
# "root+1" = "moderate"

# 原生增强；Banyan 根参考配置对尾列文件夹使用 moderate，可改为 off。
[prefetch.prerender]
default = "off"

[prefetch.prerender.icons.folder]
tail = "moderate"
```

Banyan 根参考配置关闭预取。开启后，前端自动选择一个机制：
原生 Speculation Rules → 已活动且匹配本站脚本和范围的 Banyan SW → link prefetch。
没有可用机制时停止。浏览器支持原生规则但因设置或资源限制拒绝预取时，
不额外用另一套机制强制请求。

SW 缓存与预取独立，不必为了预取而启用 SW。启用步骤和离线页要求见[交付与缓存](/zh/p/delivery/#service-worker)。

| 档位 | SW／link 预取触发 |
| --- | --- |
| `off` | 不预取 |
| `conservative` | 主按钮按下、触摸按下或键盘聚焦 |
| `moderate` | 悬停，以及上述明确交互 |
| `eager` | 短暂悬停、触屏可见，以及上述明确交互 |
| `immediate` | 初始化完成后一次批量预取 |

同名档位传给原生规则的 `eagerness`。原生触发细节由浏览器决定；
SW／link 使用上表的触发方式。节省流量或 2G 连接关闭批量、
悬停和可见预取，明确交互仍可预取。

`prerender` 表沿用图标和列范围，未单独指定的范围使用 `off`。
Banyan 根参考配置将尾列文件夹设为 `moderate`；站点可将其改为 `off`。
仅在基础规则开启且选择原生机制时生效。它增加原生预渲染，
不会改变 SW/link 的基础预取强度。总开关关闭时两者都关闭。
原生 prefetch 请求页面 HTML；prerender 加载资源并运行页面脚本。
SW 处理 HTML 缓存缺失时，也会预热其中引用的同源指纹资源。

## 启动与缓存

页面初始化后开始预取。后续新增链接可能不会自动预取，但用户操作链接时仍可触发。完整重载后重新开始。

发送提示不表示下载完成；SW 缓存与预取相互独立。选择原生或 link 机制时，已有 SW 仍可能处理请求。诊断方法见下节。

## 诊断

在当前语言的 Powered by 页面展开“更多诊断信息”，可选择自动、原生、SW、link 或关闭。
站点在各语言页面的 `params.prefetch_debug.labels` 中维护诊断控件文案。
应用后重载，仅影响此诊断页；普通页面忽略测试参数。
强制模式不可用时直接显示原因，不切换到另一机制。
全站关闭时，仍可在诊断页明确选择机制测试。

页面显示能力、选择结果、潜在 URL、提示发送次数、已知失败和配置。
发送次数不是下载完成次数；
原生执行结果在 DevTools 的 Speculative loads 中查看。

选择原生或 link 不会绕过已有 SW 的 fetch/cache。
需要绕过时，在 DevTools → Application → Service Workers 使用
Bypass for network。诊断页不自动安装、注销 SW 或清除缓存。
