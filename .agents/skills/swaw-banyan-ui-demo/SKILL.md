---
name: swaw-banyan-ui-demo
description: 在 Banyan 仓库中制作基于当前站点的交互对照 demo，比较排版、配色和控件位置，供用户选择后再应用到正式站点。
---

# Banyan UI 对照 demo

基于当前源码制作演示，旧 demo 仅供参考。未经用户选择，不将演示方案应用到正式源码；演示任务不包含暂存或提交。

## 演示约定

使用“顶部对照工具栏 + 同源 iframe 中的真实站点”。保留当前站点作为对照基准，各方案只改变本次要比较的部分。

- 工具栏提供方案切换、页面场景、明暗模式和“重开示例”，并用一行说明当前方案的差异。补充的正文或测试数据须明确标注。
- 将方案、场景和明暗模式写入外层 URL 的查询参数，便于直接打开指定对照。同步外层与 iframe 的 `data-theme`，不修改正式站点保存的外观偏好。
- 在同一场景中切换方案时，不重载 iframe。通过 `data-demo-*` 属性或移动原有节点实现差异，保留排序、事件和阅读位置。站内跳转后，在 iframe 的 `load` 回调中重新应用当前方案。
- “重开示例”重新打开所选场景的入口，恢复页面的初始交互状态，并保留当前方案和明暗模式。
- 工具栏样式与 iframe 内的方案样式分开。方案样式只在对应的 `data-demo-*` 属性下生效。

## 构建与预览

演示成果保留在 `temp_workspace/demo/<topic>/`：

```text
index.html   #对照工具栏与 iframe 入口
site/        #当前站点的构建快照
build.mjs    #构建站点快照
preview.mjs  #启动演示预览
```

过程文件按根目录 `AGENTS.md` 放入系统临时目录。完成后保留演示成果，使用户可以再次打开。

以下命令均从仓库根目录运行。脚本用 `process.cwd()` 定位仓库，用 `import.meta.url` 定位自身所在的 demo 目录。

复用以下工具，不另装依赖。表中 `tasks/` 指 `.agents/skills/swaw-banyan/tasks/`。

| 用途 | 模块与接口 |
| --- | --- |
| Hugo 路径 | `tasks/_shared/tools/operations.mjs`：`toolExecutable('hugo')` |
| 隔离构建环境与站点挂载 | `tests/_shared/hugo.mjs`：`fixtureEnvironment(work)`、`fixtureSiteMounts` |
| 本地预览 | `tasks/check/browser/_shared/server.mjs`：`createStaticSiteServer(directory)` |
| 浏览器 | `tasks/_shared/browser/runtime.mjs`：`loadChromium()`、`loadWebkit()` |
| 页面就绪 | `tasks/check/browser/_shared/viewport.mjs`：`waitForBrowse()`、`afterPaint()` |

`build.mjs` 使用当前源码和 `hugo.toml`，按以下参数调用 Hugo：

```text
--minify --noBuildLock --config hugo.toml,<临时配置> --baseURL http://localhost/site/ --destination <demo绝对路径>/site
```

演示所需的修改与正式站点隔离：

- 配色通过临时配置的 `params.appearance.palette` 指定。
- 模板覆写、图标注册和内容场景通过临时挂载实现。添加挂载时，保留站点的 assets、i18n 和 layouts 挂载。少量示例内容也可由外层 `<template>` 提供，仅作用于指定场景。
- 不为演示修改正式 Module、theme、content 或配置。

将单个 demo 目录传给 `createStaticSiteServer()` 作为服务根目录：外层页面位于 `/`，站点位于 `/site/`。构建时不写入运行端口；iframe 入口用 `new URL('site/', location.href)` 解析。仅在实际发现站内链接缺少 `/site/` 前缀时补齐，保留查询参数、锚点和外链行为，避免重复添加前缀。

`preview.mjs` 调用服务的 `start()` 启动预览，用 `getBaseUrl()` 输出实际地址，并在退出时调用 `stop()`。

```text
node temp_workspace/demo/<topic>/build.mjs    #构建当前站点快照
node temp_workspace/demo/<topic>/preview.mjs  #启动预览并输出实际地址
```

## 复用站点组件

- 控件使用 `.item-control`，图标使用 `.item-icon` 容器和 `.icon`。图标来自 `assets/site/icons.toml`，由 `system-ui/icon/render.html` 渲染并注册到 sprite。脚本新增 `<use>` 时，确认对应 symbol 已随构建输出。
- 颜色沿用 theme 变量和 `currentColor`，仅在比较配色时覆盖。正文使用 `.prose`；列和滚动复用 `.page-column`、`.page-content` 及现有宽度变量。
- 场景没有正文时，不增加空列、正文开关或占位。

## 检查与交付

按本次改动选择内容场景，验证方案切换及原有交互。默认检查 Chromium；涉及布局或浏览器差异时补查 WebKit。检查明暗模式，并查看代表性的桌面和手机截图。

注意以下检查陷阱：

- 手机布局先将主列按 `inline: 'start'` 对齐视口，再检查按钮边界。不要先点击控件或调用 `scrollIntoViewIfNeeded()`，自动横移会掩盖按钮原本不可见的问题。
- 检查图标在有色背景上是否实际可见。缺少 `.item-icon` 容器时，图标可能被背景盖住，仅检查计算颜色无法发现此问题。
- 若方案涉及打印或无脚本阅读，检查站点构建的内容顺序和裁切。检查无脚本页面时，不调用依赖 `requestAnimationFrame` 的 `afterPaint()`；对照工具本身可以依赖 JavaScript。

交付时保持预览服务运行，提供可直接打开的 HTTP 方案链接，说明主要差异和已检查范围。
