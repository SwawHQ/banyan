---
title: Service Worker 回归检查
slug: service-worker-regression-checklist
description: 检查安装、缓存、升级、导航、失败处理和停用行为。
---

本清单描述当前行为。使用根站点内容构建测试。

## 程序更新契约

- 浏览器默认安装、等待与激活生命周期保留，后台发现新版不重载页面。
- SW 程序的自动更新检查交给浏览器；前端只监听更新事件，不在页面启动、定时或恢复可见时追加程序检查。
  预渲染文档等到激活后再注册和监听；手动检查由面板按钮触发。
- 普通站内同标签页链接指向另一文档（路径或查询不同），且已经有 waiting worker 时，先激活再打开目标地址。
- 没有 waiting worker 时直接执行原生跳转，不为每次点击联网检查。
- 同页锚点、当前页链接、下载、外链、修饰键和新标签页链接不触发主动升级。
- 刷新、返回、前进不主动升级或追加重载；滚动和历史恢复交给浏览器。
- 其他标签页可以被新 worker 接管，但不重载，其 DOM 和输入内容保留。
- 已有活动程序时，新程序安装先准备自己的离线页和指纹资源，不切换当前内容版本。
  每次安装先清空本程序的暂存。缺少内容版本时，版本 JSON 也写入暂存。
  激活时读取最终内容版本；仍无版本时，用暂存初始化。
  激活不等待网络；准备失败则保留旧程序。
- `powered-by/` 内嵌 PWA 面板的按钮始终只检查，包括 ready 时重复点击也不激活、不重载。
- 离开页面或执行历史/锚点导航后，取消原待完成跳转，避免异步回调覆盖新的导航意图。

## 内容版本

站点构建版本写入固定地址 `sw-version.json`。仅内容版本改变时，`sw.js` 字节不变，
不触发程序安装或激活。版本 JSON 必须与该版本内容一同部署；
若手动设置 `params.build.version`，每次内容发布都需更新该值。

在站点的 `data/delivery.toml` 中设置最小检查间隔：

```toml
[service_worker]
content_check_interval = 5
```

单位为分钟，默认 5 分钟。达到间隔后的首次成功导航响应会安排 15 秒后的检查；
后续导航不重复安排，也不重置延迟。没有导航时不检查。JSON 请求由 SW 发出，
不依赖页面通知，不阻塞导航响应。

- 当前内容版本与上次检查尝试时间持久保存；待执行任务仅保存在内存中。
- 请求超时、失败或 JSON 无效时，保留原版本；下次检查仍受最小间隔限制。
- 检查时间缺失、无效或晚于当前时间时，允许重新检查。
- 发现新版本后，准备新缓存和离线页，再切换后续请求并清理旧内容缓存。
  进行中的旧版本请求不得重新创建已删除的缓存。
- 内容切换不刷新当前页面；新版本只影响后续请求。手动按钮仍只检查 SW 程序更新。

## 模块与事实源

- `assets/js/pwa/update-engine.js` 负责注册、手动检查、浏览器更新事件、状态订阅及激活。
- `assets/js/pwa/navigation.js` 处理符合条件的链接，复用 `updates.activate()`，不调用 reload。
- `updates.activate()` 返回是否成功，不自行跳转、刷新、注销或清缓存。
- `assets/js/updates/page.js` 只在 Powered by 页装配内嵌面板；三语言 `content/powered-by/index*.md` 提供文案。
- 判断待升级版本直接读取 `registration.waiting`，不另存 waiting worker 镜像。

## 激活失败

4 秒是一次激活等待的上限，不是强制恢复的倒计时。

- 激活异常或超时：普通链接继续前往原目标，不清除缓存或注销注册。
- 移除临时监听和定时器，不保留迟到的重载回调。
- 不注销 registration，不清缓存，不触发延迟刷新。
- 若 worker 后来完成激活，由浏览器接管，已打开页面不因此重载。

## 缓存契约

- navigation：cache-first，缓存名按内容版本区分。
- 导航缓存未命中时，HTTP 请求使用 `cache: no-cache` 重新验证，避免旧 HTTP HTML 写入新版 SW 缓存。
- assets：cache-first，指纹资源跨版本保留。
- `sw.js` 不进入 Cache Storage，`sw-version.json` 不进入内容缓存桶；两者每次请求均校验。
  `sw-content-state` 单独保存当前版本和上次检查时间。
- 内容版本切换清理旧 navigation/versioned 缓存；指纹缓存跨版本保留。
- 首次导航扫描 HTML 并预热其引用的 CSS/JS 等资源。
- 未缓存页面离线时使用对应语言的离线页；缓存命中的页面离线可读。
- navigation preload 保持关闭。

## 自动化场景

对已启用 SW 的生产构建运行 `swban check/browser/site <build> --updates`。
脚本自动发现更新面板及相互连接的根入口，临时构建不同版本，并生成程序修订以检查 SW 升级。
内容版本变化单独检查。其他位置的源码通过 `--site` 指定。缺少合适页面或配置时明确失败。
也可以直接调用下面的独立任务，按其 `--help` 指定实际路径及前后两份构建：

| 场景 | 覆盖内容 |
| --- | --- |
| `check/browser/pwa/offline` | 首次导航及引用资源预热、离线刷新、sw.js 不缓存及响应头 |
| `check/browser/pwa/activate` | ready 后跳转并切换控制器、其他标签页及草稿保留、无额外导航或延迟重载 |
| `check/browser/pwa/content` | 同 SW 程序下的延迟检查、并发去重、内容切桶、指纹缓存保留及程序更新取消后台任务 |
| `check/browser/pwa/native` | 刷新、历史、锚点及修饰键打开新标签页不主动激活 |
| `check/browser/pwa/timeout`、`pwa/error` | 激活超时/异常仍正常跳转，registration 和缓存不被清理 |
| `check/browser/pwa/cancel` | 等待激活期间转向锚点，原跳转不得在稍后覆盖新意图 |
| `check/browser/pwa/check` | 无页面启动、轮询及可见性检查、手动检查、离线重试、隐藏控件静默、重复检查不重载、跳转应用新版 |
| `check/browser/pwa/language` | 等待更新时语言选项仍可操作；按需单独运行 |
| `check/browser/canvas/open`、`canvas/history` | 来源、排序和原生滚动/历史行为；按需单独运行 |

`check/browser/csp` 验证浏览器 CSP；`pwa/offline` 验证 SW 响应头和 navigation preload。

## disable 模式

停用是独立功能。`worker-disable.js` 主动激活、清理受管缓存，`manager-disable.js` 注销根作用域注册；无关缓存必须保留。

使用独立构建对运行 `swban check/browser/pwa/disable <enabled> --next <disabled>`。
正常更新失败不调用这套停用流程，site 批量入口也不会额外生成停用版本。
## 检查流程

在站点根目录调用已安装的 Skill，对已完成的构建运行检查：

```text
swban check/csp <build>                      #检查内联哈希与发布响应头
swban check/browser/site <build> --updates  #检查代表页面与 SW 升级
swban check/http/security <url>             #部署后检查实际响应头
```

按报告处理失败项与跳过项。测试停用功能时，另行提供启用与停用两份实际构建。
