---
title: Service Worker 回归检查
slug: service-worker-regression-checklist
description: 检查安装、缓存、升级、导航、失败处理和停用行为。
---

本清单描述当前行为。使用根站点内容构建测试。

## 更新契约

- 浏览器默认安装、等待与激活生命周期保留，后台发现新版不重载页面。
- 普通站内同标签页链接指向另一文档（路径或查询不同），且已经有 waiting worker 时，先激活再打开目标地址。
- 没有 waiting worker 时直接执行原生跳转，不为每次点击联网检查。
- 同页锚点、当前页链接、下载、外链、修饰键和新标签页链接不触发主动升级。
- 刷新、返回、前进不主动升级或追加重载；滚动和历史恢复交给浏览器。
- 其他标签页可以被新 worker 接管，但不重载，其 DOM 和输入内容保留。
- `powered-by/` 内嵌 PWA 面板的按钮始终只检查，包括 ready 时重复点击也不激活、不重载。
- 离开页面或执行历史/锚点导航后，取消原待完成跳转，避免异步回调覆盖新的导航意图。

## 模块与事实源

- `assets/js/pwa/update-engine.js` 负责注册、后台检查、状态订阅及激活。
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

- navigation：cache-first，缓存名按构建版本区分。
- 导航缓存未命中时，HTTP 请求使用 `cache: no-cache` 重新验证，避免旧 HTTP HTML 写入新版 SW 缓存。
- assets：cache-first，指纹资源跨版本保留。
- sw.js：不进入 Cache Storage；响应头必须为 `no-cache, max-age=0, must-revalidate`。
- 新 worker 激活清理旧 navigation/versioned 缓存。
- 首次导航扫描 HTML 并预热其引用的 CSS/JS 等资源。
- 未缓存页面离线时使用对应语言的离线页；缓存命中的页面离线可读。
- navigation preload 保持关闭。

## 自动化场景

对已启用 SW 的生产构建运行 `swban check/browser/site <build> --updates`。
脚本自动发现更新面板及相互连接的根入口，临时构建不同版本；只改变版本配置，
不修改站点内容。其他位置的源码通过 `--site` 指定。缺少合适页面或配置时明确失败。
也可以直接调用下面的独立任务，按其 `--help` 指定实际路径及前后两份构建：

| 场景 | 覆盖内容 |
| --- | --- |
| `check/browser/pwa/offline` | 首次导航及引用资源预热、离线刷新、sw.js 不缓存及响应头 |
| `check/browser/pwa/activate` | ready 后跳转升级、已缓存目标使用新版、旧 navigation 缓存删除、其他标签页及草稿保留、无延迟重载 |
| `check/browser/pwa/native` | 刷新、历史、锚点及修饰键打开新标签页不主动激活 |
| `check/browser/pwa/timeout`、`pwa/error` | 激活超时/异常仍正常跳转，registration 和缓存不被清理 |
| `check/browser/pwa/cancel` | 等待激活期间转向锚点，原跳转不得在稍后覆盖新意图 |
| `check/browser/pwa/check` | 手动检查、离线重试、隐藏控件静默、重复检查不重载、跳转应用新版 |
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
