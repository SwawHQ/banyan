# Service Worker 回归检查

本清单描述当前行为。仅使用项目根内容构建测试，不使用 exampleSite。

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

准备两份均包含本次实现、构建版本不同的根内容生产产物，通过以下变量明确选择：

- `BANYAN_BROWSER_BUILD_DIR`
- `BANYAN_BROWSER_UPGRADE_FROM_DIR`
- `BANYAN_BROWSER_UPGRADE_TO_DIR`

运行 `node themes/banyan/scripts/browser-regression/browser.mjs`，可用 `BANYAN_BROWSER_ONLY` 选择：

| 场景 | 覆盖内容 |
| --- | --- |
| `sw-home-register` | 首次导航及引用资源预热、离线刷新、sw.js 不缓存及响应头 |
| `sw-update-entry-home`、`sw-update-entry-collection` | ready 后跳转升级、已缓存目标使用新版、旧 navigation 缓存删除、其他标签页及草稿保留、无延迟重载 |
| `sw-update-native-navigation` | 刷新、历史、锚点及修饰键打开新标签页不主动激活 |
| `sw-update-navigation-timeout`、`sw-update-navigation-throw` | 激活超时/异常仍正常跳转，registration 和缓存不被清理 |
| `sw-update-navigation-cancel` | 等待激活期间转向锚点，原跳转不得在稍后覆盖新意图 |
| `sw-update-check` | 手动检查、离线重试、重复检查不重载、跳转应用新版及路径列 |
| `sw-update-hidden-control-stays-quiet` | 隐藏控件不触发弹窗或自动激活 |
| `sw-update-language-page-static` | 等待更新时语言选项仍可操作 |
| `canvas-source-navigation`、`canvas-history-scroll-restoration` | 来源、排序和原生滚动/历史行为 |

`browser-security.mjs` 验证 CSP、响应头与 navigation preload。

## disable 模式

停用是独立功能。`worker-disable.js` 主动激活、清理受管缓存，`manager-disable.js` 注销根作用域注册；无关缓存必须保留。

使用独立的 enable/disable 构建对运行 `browser-sw-disable.mjs`。正常更新失败不调用这套停用流程。

## 历史验证（2026-09-15）

根内容生产构建对：`temp_workspace/public/2609152303-pwa-navigation-final-from` → `2609152303-pwa-navigation-final-to`。132 页 HTML 审计通过。

16 项浏览器检查通过：`temp_workspace/regression/260915230441-browser`（11 项）、`260915230601-browser`（取消跳转）、`260915230515-browser-security`（3 项）、`260915230640-browser-sw-disable`（停用）。停用产物使用临时配置同时关闭依赖 SW 的预取运行时，未改项目配置。

## Powered by 与检查行为验证（2026-09-16）

根内容生产构建对：`temp_workspace/public/2609161139-powered-by-final-from` → `2609161139-powered-by-final-to`。129 页 HTML 审计通过。

`temp_workspace/regression/260916114003-browser` 的 16 项浏览器检查通过，覆盖三语言技术总览与 SVG、PWA 子页、重复检查不刷新、站内跳转升级、其他标签页状态同步与草稿保留、原生历史、激活异常和首次导航资源预热。`260916114003-browser-security` 的 3 项检查验证 CSP、SW 响应头和 navigation preload。

## PWA 面板内嵌验证（2026-09-16）

`powered-by/` 已合并 PWA 状态与检查；构建时间只在总览显示一次，删除独立 PWA 子页。生产构建对为 `2609161156-powered-by-inline-from` → `2609161156-powered-by-inline-to`，126 页 HTML 审计通过。

`temp_workspace/regression/260916115710-browser` 的 7 项检查通过：三语言总览与内嵌面板、脚本加载边界、根导航、离线重试与重复检查不刷新、首页／列表跳转升级、跨标签页草稿保留和原生刷新／历史行为。桌面及手机端截图已检查。

## 提交前复核（2026-09-16）

根内容构建对 `2609161316-reviewed-from` → `2609161316-reviewed-to` 的 17 项浏览器回归全部通过（`temp_workspace/regression/260916131657-browser`），另有 3 项安全检查通过（`260916131644-browser-security`）。覆盖根入口、三语言账号链接、页面脚本边界、首次导航资源预热、重复检查、升级与旧导航缓存清理、跨标签页保留状态、超时／异常／取消跳转及原生历史。桌面和手机端截图已检查。

最终构建 `2609161318-reviewed-final` 的 126 页 HTML 审计通过；按站点维护者决定，不为已删除的 Updates/check/changelog 地址增加迁移跳转，三语言旧产物及对应重定向均不存在。源码发布契约审计亦已通过。
