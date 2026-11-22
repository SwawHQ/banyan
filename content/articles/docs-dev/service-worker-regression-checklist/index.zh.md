---
title: 检查：Service Worker 回归
date: 2026-11-06
lastmod: 2026-11-14
url: p/service-worker-regression-checklist/
description: 定位 SW 源码，检查程序更新、内容版本与停用边界。
---

在 Banyan 源码仓库修改 `assets/site/delivery.toml` 或生成 `sw.js` 的逻辑后，运行 [SW 验收夹具](https://github.com/SwawHQ/banyan/blob/main/tests/README.md#sw-acceptance)。夹具自动构建程序更新和内容更新所需的两组产物。站点配置见[交付与缓存](/zh/p/delivery/)。

## 源码入口

| 位置（相对 `module/`） | 职责 |
| --- | --- |
| `layouts/_partials/system-delivery/pwa/` | 配置和程序资源装配 |
| `assets/js/pwa/worker-enable.js.tmpl` | 缓存、程序生命周期和站点构建版本 |
| `assets/js/pwa/manager-entry.js.tmpl` | 普通页面注册 |
| `assets/js/site-status/` | Powered by 的程序与内容检查 |
| `assets/js/pwa/worker-disable.js`、`manager-disable.js` | 停用与清理 |
| `assets/js/pwa/cache-names.js` | 受管缓存名称 |

## 页面与程序更新

普通页面加载完成后注册，预渲染页面在激活后注册。浏览器负责正常程序更新与激活；页面链接、刷新、历史导航和检查按钮不能提前激活 waiting 程序，也不能自动重载页面。

检查首次安装、存在活动程序时的更新、等待期间的内容更新，以及停用后重新启用。首次安装须取得有效站点构建版本。断网时，已缓存页面应可重载，未缓存的受管页面应返回内置 503 提示。

## 站点构建版本

站点构建版本与 SW 程序版本分别变化。只改内容版本时，`sw.js` 字节应保持不变。版本 JSON 须与内容一同部署；手动设置 `params.build.version` 时，每次内容发布都要更新它。

达到检查间隔后的首次受管导航应启动后台检查，不等待导航成功，不阻塞导航响应；并发导航共用一次请求。失败时保留原版本。waiting 程序存在时，活动程序仍可检查内容。

发现新构建版本后，后续请求使用新缓存；已打开页面保持原状。版本切换清理旧版本缓存，保留指纹缓存。旧请求完成时不能重新创建已删除的缓存。

## 缓存契约

缓存与 HTTP 响应头分别配置。版本缓存未命中时重新验证 HTTP 缓存，避免旧 HTML 写入新版本缓存。`sw.js` 与 `sw-version.json` 不进入页面或资源缓存桶。

首次访问尚未受 SW 控制，页面不追加缓存预热。受控导航缓存 HTML 并预热同源指纹资源。断网后，已缓存页面可重载，未缓存的受管页面返回内置英文 503 提示。

## disable 模式

`disable` 使用独立的清理程序注销本站 SW，删除受管缓存，保留无关缓存。`off` 不执行清理。正常更新不能调用停用流程。

## 自动化场景

对已启用 SW 的生产构建运行代表检查；停用另行提供启用与停用两份实际构建：

```text
swban check/browser/site <build> --updates                  #检查代表页面与 SW 更新
swban check/browser/pwa/disable <enabled> --next <disabled>  #检查停用
swban check/http/security <url>                             #部署后检查响应头
```

准备方式、单项任务、页面要求和报告范围统一见 Skill 的[浏览器检查](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/browser-site.md)。两个实际代码版本的比较应使用实际构建对；临时生成的更新构建只用于检查更新机制。
