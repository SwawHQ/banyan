---
title: 未发布
slug: unreleased
description: Banyan 主题和 Skill 的未发布变更。
lastmod: 2026-10-13
---

## 新增

- 通过 `github.com/SwawHQ/banyan/module` 发布 Hugo Module，
  `swaw-banyan` Skill 使用对应版本。`check/module` 检查发布版本、
  vendor 依赖和本地开发状态。
- 提供 Windows x64 命令行工具，支持 Bun 或 Node、Git、Go、Hugo
  和可选的 GitHub CLI。便携版下载使用校验和验证；站点不需要安装 npm 依赖。
- 新增名称列表和产品列表，复用多列导航和排序。产品分类由站点定义。
- Powered by 页面显示实际主题版本、Hugo 版本、站点构建信息，
  以及 PWA 状态和更新检查控件。
- 演示站点按版本组织 `content/changelog/` 下的发布记录。
  `params.theme_changelog` 设置 Powered by 页面的变更记录地址。
- 浏览器检查覆盖导航、布局、语言设置、图片、预取和 PWA。
  支持 Chromium，部分检查支持 WebKit。`check/browser/site`
  自动查找代表页面，并报告未检查的范围。
- 静态检查和 HTTP 检查覆盖内容声明、HTML、站点地图、robots、LLMS、
  图片、CSP、SRI、缓存响应头和预取。提供资源体积和页面数据体积报告。
  HTML 检查也验证文章日期行、路径顺序、侧栏控制脚本和静态更新控件。
- `sync/ext` 同步声明的外部资源；`deploy/edgeone/sync`
  同步构建生成的部署配置。
- 仓库、Module 和 Skill 均包含 MIT 许可证，并保留第三方许可声明。

## 调整

- 来源和排序参数 `from`、`sort`、`sorts` 移到 URL 的 `#` 后，
  章节定位与这些状态共存。浏览器后退和前进会恢复来源和路径列排序。
  移除 `navigation-state-default.toml` 配置；
  旧查询参数不再控制导航视图。
- 交付配置集中到 `data/delivery.toml`，模块默认值在 `data/banyan/delivery.toml`。
  `prefetch_runtime`、`speculation_rules` 和 `service_worker` 从 Hugo `params`
  移到此文件，应用到所有语言。表按字段合并，不再接受旧配置入口。
  部署参数使用 `platform.edgeone.makers`；路径特例使用
  `http.edgeone.makers` 和 `http.cloudflare.pages`，`http` 与 `sw` 独立配置。
  SW 只使用 `sw.bucket`（`versioned`、`fingerprinted`、`off`），支持路径任意位置的
  单个通配符，区分路径大小写，后声明的匹配规则优先。默认覆盖同源 GET 请求，
  包括 JSON 和 XML。按版本缓存未命中时校验 HTTP 缓存，关联资源只预热指纹 URL。
  站点规则数组替换默认数组，不再接受旧格式。
  Speculation Rules 发布到 `/site/speculation-rules/`，复用默认 `/site/*` 的
  HTTP 和 SW 缓存策略。
  移除未使用的 `/icon/*` 不可变缓存规则。
- 站点地图默认收录已渲染且允许索引的 HTML 页面，不受 `build.list` 影响。
  在内容前置配置中用原生 `sitemap.disable` 排除页面，
  移除 `params.sitemap.include_pages`。禁止索引的页面和被排除的译文
  不进入站点地图条目或其他语言链接。
- 主题从 `module/` 发布，演示站点保留在仓库根目录。
  站点专用内容和配置放在 Module 之外。
- 构建和预览使用原生 Hugo 命令。发布使用原生 Git 和 GitHub CLI 命令。
- 由 Hugo 构建并压缩 JavaScript，在构建阶段生成 CSP 和部署响应头。
  站点必须设置 `minify.disableJS = true`，以保持内联脚本与 CSP 哈希一致。
- PWA 检查不激活更新或刷新页面。新版本准备就绪后，
  在下一次同标签页的普通站内链接导航前激活。
  刷新、历史记录和其他标签页保持原生行为。
- 列表显示日期和日期排序先读取 `lastmod`，再读取 `date`。
  Git 提交和文件系统时间不改变内容日期。

## 修复

- Cloudflare 缓存和 XML CSP 特例先删除继承的响应头，再设置新值，
  避免多个冲突值被拼接。
- 章节滚动执行时读取当前 URL 片段，避免待执行的章节滚动
  覆盖后续的“跳到正文”操作。
