# Service Worker 回归检查

本清单描述当前行为。仅使用项目根内容构建测试，不使用 exampleSite。

## 更新契约

- 浏览器默认安装、等待与激活生命周期保留，后台发现新版不重载页面。
- 普通站内同标签页链接指向另一文档（路径或查询不同），且已经有 waiting worker 时，先激活再打开目标地址。
- 没有 waiting worker 时直接执行原生跳转，不为每次点击联网检查。
- 同页锚点、当前页链接、下载、外链、修饰键和新标签页链接不触发主动升级。
- 刷新、返回、前进不主动升级或追加重载；滚动和历史恢复交给浏览器。
- 其他标签页可以被新 worker 接管，但不重载，其 DOM 和输入内容保留。
- `updates/check/` 的按钮继续手动检查，ready 时手动激活并重载本页。
- 离开页面或执行历史/锚点导航后，取消原待完成跳转，避免异步回调覆盖新的导航意图。

## 模块与事实源

- `assets/js/pwa/update-engine.js` 负责注册、后台检查、状态订阅及激活。
- `assets/js/pwa/navigation.js` 处理符合条件的链接，复用 `updates.activate()`，不调用 reload。
- `updates.activate()` 返回是否成功，不自行跳转、刷新、注销或清缓存。
- `assets/js/updates/page.js` 只装配检查页；三语言 `content/updates/check/index*.md` 提供文案。
- 判断待升级版本直接读取 `registration.waiting`，不另存 waiting worker 镜像。

## 激活失败

4 秒是一次激活等待的上限，不是强制恢复的倒计时。

- 激活异常或超时：普通链接继续前往原目标；手动检查页显示失败，可再次检查。
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
| `sw-update-check` | 手动检查、离线重试、手动应用并刷新、更新后版本及路径列 |
| `sw-update-hidden-control-stays-quiet` | 隐藏控件不触发弹窗或自动激活 |
| `sw-update-language-page-static` | 等待更新时语言选项仍可操作 |
| `canvas-source-navigation`、`canvas-history-scroll-restoration` | 来源、排序和原生滚动/历史行为 |

`browser-security.mjs` 验证 CSP、响应头与 navigation preload。

## disable 模式

停用是独立功能。`worker-disable.js` 主动激活、清理受管缓存，`manager-disable.js` 注销根作用域注册；无关缓存必须保留。

使用独立的 enable/disable 构建对运行 `browser-sw-disable.mjs`。正常更新失败不调用这套停用流程。

## 本轮验证（2026-09-15）

根内容生产构建对：`temp_workspace/public/2609152303-pwa-navigation-final-from` → `2609152303-pwa-navigation-final-to`。132 页 HTML 审计通过。

16 项浏览器检查通过：`temp_workspace/regression/260915230441-browser`（11 项）、`260915230601-browser`（取消跳转）、`260915230515-browser-security`（3 项）、`260915230640-browser-sw-disable`（停用）。停用产物使用临时配置同时关闭依赖 SW 的预取运行时，未改项目配置。
