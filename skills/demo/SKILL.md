---
name: banyan-ui-demo
description: 在 Banyan 仓库中制作基于当前站点的 HTML/CSS 交互对照 demo，比较排版、配色和控件位置，供用户选择后再应用到正式站点。
---

# Banyan UI 对照 demo

本文件是新会话的工作入口。先读仓库 `AGENTS.md`，再按本文件制作演示。

新会话可以这样开始：

> 请先读 `skills/demo/SKILL.md`，基于当前站点制作「要比较的改动」的对照 demo，暂不应用到正式站点。

## 演示方式

使用「顶部对照工具栏 + 同源 iframe 中的真实站点」。保留当前字体、图标、列宽、排序、选中状态和正文内容，只改变本次要比较的变量。

- 工具栏提供方案切换、页面场景、明暗模式和“重开示例”。方案名称写明实际区别，例如“正文在列表下方”。
- 工具栏下用一行说明当前方案。演示补充的长正文或测试数据要明确标注。
- 同一场景切换方案时，优先调整 iframe 的 `data-demo-*` 属性或移动原有 DOM 节点，不重新加载页面。这样容易比较位置、留白和阅读状态。
- iframe 保留实际链接、排序和控件操作。跳转到新页面后，在 iframe 的 `load` 回调中重新装配演示。
- 方案、场景和明暗模式写入外层 URL 查询参数，使用户能直接打开指定对照。同步外层与 iframe 的 `data-theme`，不修改正式站点的外观偏好。

不要把工具栏样式注入 iframe。用独立 CSS 文件控制工具栏，另用 `variants.css` 控制站点内的差异。

## 文件与临时目录

每个主题单独建目录，以下结构按实际需要使用：

```text
skills/demo/SKILL.md #工作入口
temp_workspace/demo/
  <topic>/
    index.html       #工具栏、状态说明、iframe
    compare.css      #对照工具栏与窄屏布局
    compare.js       #场景、方案、主题和 iframe 装配
    variants.css     #站点内的方案差异
    build.mjs        #构建当前站点快照
    preview.mjs      #启动此 demo 的本地预览
    site/           #构建后的真实站点
```

`temp_workspace/demo/` 存放可继续打开的演示成果。构建配置、模板覆写、缓存和检查截图放在系统临时目录的 `swaw/banyan/<task>/`。任务完成后只清理本任务的过程文件，保留 demo。

所有命令默认从仓库根目录运行。用 `process.cwd()` 定位仓库，用 `import.meta.url` 定位当前 demo。不要沿用旧 demo 中固定的 `../../..` 层数，新目录深度可能不同。

## 构建当前站点

先读实际涉及的模板和 CSS。已有 demo 是参考，不是当前实现的依据。

复用仓库工具：

| 用途 | 位置与接口 |
| --- | --- |
| Hugo 路径 | `.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs` 的 `toolExecutable('hugo')` |
| 隔离构建环境 | `tests/_shared/hugo.mjs` 的 `fixtureEnvironment(work)` |
| 临时挂载 | 同一文件的 `fixtureSiteMounts`；加入自定义 mounts 时保留站点 assets、i18n 和 layouts |
| 本地预览 | `.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs` 的 `createStaticSiteServer(directory)` |
| 浏览器 | `.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs` 的 `loadChromium()`、`loadWebkit()` |
| 页面就绪 | `.agents/skills/swaw-banyan/tasks/check/browser/_shared/viewport.mjs` 的 `waitForBrowse()`、`afterPaint()` |

`build.mjs` 用 Node 调用 Hugo，检查进程错误和退出码。构建参数采用：

```text
--minify --noBuildLock --config hugo.toml,<临时配置> --baseURL http://localhost/site/ --destination <当前demo绝对路径>/site
```

这里的 URL 对应“单个 demo 目录作为服务器根目录”：外层为 `/`，站点为 `/site/`。不把运行端口写入构建，不假定旧会话中的服务仍存在。

- 用当前 `hugo.toml` 和当前源码构建。需要指定配色时，在临时配置中设置 `params.appearance.palette`。
- 改动仅涉及 CSS 或布局时，正式 Module、theme、content 和配置均不因 demo 而修改。
- 需要不同模板或新增图标注册时，在临时目录建立 Hugo 模板覆写并挂载。不要为演示修改正式模板。
- 少量长文字或空内容场景可以通过临时内容挂载，或外层 `<template>` 生成。只作用于指定场景。
- 生成的链接应保留 `/site/` 前缀。实际发现裸根路径的站内跳转时，才在演示中补齐前缀；保留 query、hash 和外链行为，避免重复添加前缀。

临时目录可用 `fs.mkdtempSync()` 创建。清理前校验真实路径的父目录，防止删除站点或其他任务文件。

## 启动预览

每个 demo 自带 `index.html`。下面的 `preview.mjs` 服务其所在目录，因此无需公共索引页：

```js
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const helper = path.join(process.cwd(),
  '.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs');
const {createStaticSiteServer} = await import(pathToFileURL(helper).href);
const server = await createStaticSiteServer(path.dirname(fileURLToPath(import.meta.url)));
await server.start();
console.log('Demo: ' + server.getBaseUrl() + '/');
process.once('SIGINT', () => server.stop());
process.once('SIGTERM', () => server.stop());
```

```text
node temp_workspace/demo/<topic>/build.mjs    #构建当前站点快照
node temp_workspace/demo/<topic>/preview.mjs  #启动预览并输出实际地址
```

保持预览服务运行，向用户提供工具实际输出的 HTTP 地址。iframe 的站点入口用 `new URL('site/', location.href)` 解析。不要把 `file://` 当作交互演示的打开方式。

## 实现方案差异

外层 `compare.js` 负责以下内容：

1. 读取 URL 中的方案、场景和主题；无效值回到默认方案。
2. 在 iframe 页面加载后查找需要调整的节点，插入一次 `variants.css` 外链。
3. 对 iframe 根元素设置 `data-demo-*` 属性。CSS 只在相应属性下生效。
4. 更新工具栏的 `aria-pressed`、当前说明和 URL。

原有节点能移动就移动，保留排序、点击和键盘监听。不要重建整份列表来演示位置差异。重复切换时不得重复添加标题、按钮、样式或监听。

复用现有组件：

- 控件使用 `.item-control`；图标容器使用 `.item-icon`，图标使用原生 `.icon`。
- 图标取自 `assets/site/icons.toml`，通过 `system-ui/icon/render.html` 渲染并注册到页面 sprite。纯脚本新增 `<use>` 时，要确认对应 symbol 已随构建输出。
- `.item-icon` 负责将图标放在控件背景层之上。只加 `.icon` 而漏掉容器，可能出现“颜色已反转，但被背景盖住”。
- 颜色优先沿用当前 theme 的变量和 `currentColor`。单独比较配色时才覆盖相应变量，不复制一套反色逻辑。
- 正文继续使用 `.prose`；列和滚动优先复用 `.page-column`、`.page-content` 与现有宽度变量。
- 无正文不增加空列、开关或占位。窄屏按钮不得因增加操作列而被挤到额外一屏。

涉及按钮时保留可访问名称、`aria-controls`、`aria-expanded`、键盘焦点和 Escape 行为。只在确有展开内容时生成开关。

## 检查与交付

根据改动选择场景：短内容、长内容、空内容、文章页、名称列表或多字段列表。不要求每次都加入全部场景。

使用仓库已有的 Playwright 运行环境，不安装另一套前端或浏览器依赖。默认检查 Chromium；涉及布局或浏览器差异时补查 WebKit。新逻辑用少量断言检查实际行为，简单样式改动用目测和布局度量即可。

重点检查：

- 明暗模式与桌面、手机宽度。可从 1440、390、320 开始。
- 手机先将主列按 `inline: 'start'` 对齐视口，再检查按钮边界。不要先调用控件的 `click()` 或 `scrollIntoViewIfNeeded()`，自动横移可能掩盖“开关本来不可见”的问题。
- 比较列表宽度、字段起点、行高和正文位置，确认只改变本次要比较的部分。
- 排序仍生效；切换方案保留内容和交互；站内跳转、主题、场景及重开示例可用。
- 展开、收起与长标题不重叠。需要时检查鼠标、Enter、Escape 和焦点去向。
- 图标在有色背景上实际可见。仅检查计算后的颜色不能发现背景覆盖问题。
- 正式方案涉及打印或无脚本阅读时，在站点构建中检查内容顺序与裁切。对照工具本身可依赖 JavaScript。

至少查看代表性的桌面和手机截图。无脚本页面不使用依赖 `requestAnimationFrame` 的 `afterPaint()`；可同步读取布局，颜色测量需等待过渡完成。

交付时提供可直接打开的方案链接，说明主要差异和已检查范围。未经用户选择，不把 demo 方案应用到正式源码，不暂存或提交。

## 当前站点与历史参考

截至 2026-11-09，后续仍以当前源码为准：

- 当前站点采用黑白基调。默认配色保留轻选中背景和位置线，高对比度为独立 theme。
- 文章页的目录与信息按钮已使用 menu 图标，在标题同行右侧。
- 栏目页已选择 A：列表在前，栏目标题与正文在下方，共用纵向滚动；栏目正文没有开关。不要默认恢复右侧正文列。
- 当前栏目正文已输出 `.collection-body` 和标题。复用旧 demo 前先核对，避免再次插入相同标题，或把正式默认间距叠加到方案间距上。

历史文件仅供按需查阅，不要求整批读取，也不要求新 demo 依赖它们：

| 参考 | 可复用的做法 |
| --- | --- |
| `temp_workspace/monochrome/compare.css` | 顶部工具栏、单行说明、满高 iframe、窄屏换行 |
| `temp_workspace/monochrome/collection-body/` | 正文位置、场景切换、列表排序与导航；脚本基于改动前的结构，需要适配当前模板 |
| `temp_workspace/monochrome/high-contrast-lines/` | 表头线、标题按钮、原生图标注册与多种主题状态 |

这些旧文件的服务根目录和 URL 前缀与新目录可能不同。复用时一并核对 CSS 路径、模块导入、Hugo baseURL 和 iframe 路径。
