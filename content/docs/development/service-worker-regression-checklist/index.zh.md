---
title: Service Worker 回归检查
slug: service-worker-regression-checklist
description: 检查注册、缓存、浏览器激活、内容版本和停用行为。
---

本清单描述当前行为。使用根站点内容构建测试。

## 页面与程序更新

- 普通页面只在 `load` 后注册 SW。预渲染页面等到激活后再注册。
- 普通页面不装配更新面板、不补缓存，也不拦截链接或发送主动激活消息。
- Powered by 页面自行读取 registration，显示状态并提供手动检查。
  按钮只检查，不激活程序、不重载页面。
- 程序自动更新检查和激活交给浏览器。waiting 程序保留默认等待行为，
  不因站内链接、刷新或历史导航而提前激活。
- 浏览器激活新程序时，不额外刷新已打开页面；滚动、历史和输入内容由页面与浏览器保留。
- 已有活动程序时，新程序安装先准备离线页和指纹资源，不切换当前内容版本。
  每次安装先清空本程序的暂存，并记录当时的内容版本；缺少版本时先请求 JSON。
  激活时读取最终内容版本；仍无版本时，用暂存初始化。
  等待期间内容版本已变化时，保留当前桶已有的有效离线页，仅从暂存补齐缺失路径。
  内容版本未变化时，仍用暂存刷新离线页。
  激活不等待网络；准备失败则保留旧程序。

## 内容版本

站点构建版本写入固定地址 `sw-version.json`。仅内容版本改变时，`sw.js` 字节不变，
不触发程序安装或激活。版本 JSON 必须与该版本内容一同部署；
若手动设置 `params.build.version`，每次内容发布都需更新该值。

在站点的 `data/delivery.toml` 中设置最小检查间隔：

```toml
[service_worker]
mode = "enable"
content_check_interval = 5
offline_notice_path = "offline/"
```

此表整体替换模块默认值。间隔单位为分钟，默认 5 分钟。
达到间隔后的首次成功导航响应会安排 15 秒后的检查；
后续导航不重复安排，也不重置延迟。没有导航时不检查。JSON 请求由 SW 发出，
不依赖页面通知，不阻塞导航响应。

- 当前内容版本与上次检查尝试时间持久保存；待执行任务仅保存在内存中。
- 请求超时、失败或 JSON 无效时，保留原版本；下次检查仍受最小间隔限制。
- 检查时间缺失、无效或晚于当前时间时，允许重新检查。
- 存在 waiting 程序时，活动程序仍执行内容检查。
- 发现新版本后，准备新缓存和离线页，再切换后续请求并清理旧内容缓存。
  进行中的旧版本请求不得重新创建已删除的缓存。
- 内容切换不刷新当前页面；新版本只影响后续请求。手动按钮仍只检查 SW 程序更新。

## 页面脚本边界

- `assets/js/pwa/manager-entry.js.tmpl` 只负责注册。
- `assets/js/updates/page.js` 只在 Powered by 页查询注册和装配面板。
  三语言 `content/powered-by/index*.md` 提供文案。
- 页面不创建全局 `BanyanServiceWorkerManagerRuntime`。
- 待更新程序直接读取 `registration.waiting`。

## 缓存契约

- 缓存路径规则只来自 `data/delivery.toml`。启用时，`sw-policy.json` 复制
  `sw.js` 中实际使用的 path/bucket 数组，首个匹配项优先；关闭或停用时不输出副本。
- navigation：cache-first，缓存名按内容版本区分。
- 导航缓存未命中时，HTTP 请求使用 `cache: no-cache` 重新验证，避免旧 HTTP HTML 写入新版 SW 缓存。
- assets：cache-first，指纹资源跨版本保留。
- `sw.js` 不进入 Cache Storage，`sw-version.json` 不进入内容缓存桶；两者每次请求均校验。
  `sw-content-state` 单独保存当前版本和上次检查时间。
- 内容版本切换清理旧 navigation/versioned 缓存；指纹缓存跨版本保留。
- 首次访问发生在 SW 控制页面之前，页面不追加缓存预热。
  后续受控导航由 SW 缓存 HTML，并预热其中引用的指纹 CSS/JS。
- 未缓存页面离线时使用对应语言的离线页；缓存命中的页面离线可读。
- navigation preload 保持关闭。

## 自动化场景

对已启用 SW 的生产构建运行 `swban check/browser/site <build> --updates`。
脚本自动发现更新面板及相互连接的根入口，临时构建不同版本，并生成程序修订以检查 SW 更新。
内容版本变化单独检查。其他位置的源码通过 `--site` 指定。缺少合适页面或配置时明确失败。
也可以直接调用下面的独立任务，按其 `--help` 指定实际路径及前后两份构建：

| 场景 | 覆盖内容 |
| --- | --- |
| `check/browser/pwa/offline` | 首次访问不补缓存；受控导航后可离线刷新；sw.js 不缓存及响应头 |
| `check/browser/pwa/lifecycle` | waiting 保持等待，关闭旧受控页面后由浏览器激活 |
| `check/browser/pwa/content` | 同 SW 程序下的延迟检查、并发去重、内容切桶、指纹缓存保留及 waiting 期间继续检查 |
| `check/browser/pwa/native` | 链接、刷新、历史、锚点及新标签页使用原生导航，不主动激活 |
| `check/browser/pwa/check` | 无页面启动、轮询及可见性检查；面板手动检查、离线重试，检查不激活或重载 |
| `check/browser/pwa/language` | 等待更新时语言选项仍可操作；按需单独运行 |
| `check/browser/canvas/open`、`canvas/history` | 来源、排序和原生滚动/历史行为；按需单独运行 |

`check/browser/csp` 验证浏览器 CSP；`pwa/offline` 验证 SW 响应头和 navigation preload。

## disable 模式

停用是独立功能。`worker-disable.js` 主动激活、清理受管缓存，`manager-disable.js` 注销根作用域注册；无关缓存必须保留。
`off` 不加载管理脚本，也不清理已安装的 SW。

使用独立构建对运行 `swban check/browser/pwa/disable <enabled> --next <disabled>`。
正常更新不调用这套停用流程，site 批量入口也不会额外生成停用版本。

## 检查流程

在站点根目录调用已安装的 Skill，对已完成的构建运行检查：

```text
swban check/delivery <build>                 #检查交付配置与指纹发布路径
swban check/csp <build>                      #检查内联哈希与发布响应头
swban check/browser/site <build> --updates  #检查代表页面与 SW 更新
swban check/http/security <url>             #部署后检查实际响应头
```

按报告处理失败项与跳过项。测试停用功能时，另行提供启用与停用两份实际构建。
