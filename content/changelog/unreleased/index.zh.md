---
title: 未发布
slug: unreleased
description: Banyan 主题和 Skill 的未发布变更。
lastmod: 2026-10-18
---

## 新增

- 官网提供中文使用指南和开发资料，站点生产地址为 `https://banyan.swaw.com/`。
- 通过 `github.com/SwawHQ/banyan/module` 发布 Hugo Module，
  `swaw-banyan` Skill 使用对应版本。`doctor [目录]` 检查 Module 和
  主题目录的版本配对、vendor 依赖及本地开发状态。
  主题目录的版本读取自 `theme.toml`。`doctor` 同时检查已选工具和运行时启动器；
  启动器或绑定文件损坏时仍可诊断，并提供手动恢复步骤。
  普通任务不再检查配对。检查开关和修复提示由 `references/doctor.toml` 维护。
  整仓源码 ZIP 中的 Skill 与 `module/` 按 `module/theme.toml` 版本配对，无需 `.git`。
  修复提示包含项目地址、主题源码 ZIP 和 Module 版本调整命令。
- 提供 Windows x64 命令行工具，支持 Node/npm、Git、Go、Hugo
  和可选的 Bun、GitHub CLI。便携版下载使用校验和验证。
  uv 和 Python 3.13 在 Skill 内隔离运行脚本和 CLI，支持站点已有 uv 项目，
  不修改系统 PATH 或 Python 注册表。
  `sync/ext` 和内容检查用 npm 按需准备 Skill 内的解析依赖，与父工作区隔离；
  站点构建不需要 npm 依赖。
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
  `check/delivery` 检查生成的平台格式、指纹策略一致性和发布文件名，不读取资源正文。
  子目录部署使用 `--base-path` 指定 URL 前缀；路径字符和 EdgeOne 域名重定向按平台语法处理。
- `sync/ext` 同步声明的外部资源；`deploy/edgeone/sync`
  同步构建生成的部署配置。
- 仓库、Module 和 Skill 均包含 MIT 许可证，并保留第三方许可声明。

## 调整

- Skill 基础工具使用 `base/<tool>`、`base/<tool>/check` 和
  `base/<tool>/ensure`。入口使用 Node，按需准备 Node/npm 和所需工具；
  Bun 保留为独立工具。移除 `base/ensure`。
  Hugo 和 Go 按需准备 Git；主题不再启用未使用的 Git 页面信息。
  GitHub CLI 在使用时准备；npm 和 npx 分别使用 `base/node/npm` 和 `base/node/npx`。
  Python 命令使用 `base/uv/python`、`base/uv/python/check` 和
  `base/uv/python/ensure`；常用帮助将 uv 标为 Python 工具管理器。
  离线使用前，可用 `base/packages/ensure` 准备解析依赖；加 `--force` 重新安装。
  `doctor` 只报告依赖缺失，不执行安装。
  浏览器准备改用 `base/browser/ensure` 和 `base/browser/ensure.webkit`。
  `help/en [depth|path [depth]]` 和 `help/zh [depth|path [depth]]` 按层级列出命令和分类，
  支持从指定路径向下计算深度并保留完整路径，分类路径以 `/` 结尾，
  或显示指定路径的完整帮助；不带参数时显示常用命令，含构建、预览和发布示例。
  `help` 默认使用系统语言。帮助文件格式错误时，提示文件路径及 JSON 解析原因或具体字段。

- 预取使用统一的 `[prefetch]` 配置，按图标和列范围设置
  `conservative`、`moderate`、`eager` 或 `immediate`。
  列范围使用 `root`、`tail`、`"root+N"`、`"tail-N"` 和 `all`；根导航参与编号。
  基础预取和预渲染独立解析，尾列文件夹默认使用 `moderate` 预渲染。
  前端自动选择原生规则、活动的 Banyan SW 或 link；可选范围支持原生 prerender。
  原生规则静态内联并由 CSP 哈希许可，待导航和排序就绪后激活。
  自实现只初始化一次，保留页面内去重，移除会话去重。
  诊断页提供单页机制选择、重载测试和发送状态；未配置图标使用默认策略。
  预取体积报告移除无效的旧 URL 计数。
- 来源和排序参数 `from`、`sort`、`sorts` 移到 URL 的 `#` 后，
  章节定位与这些状态共存。浏览器后退和前进会恢复来源和路径列排序。
  移除 `navigation-state-default.toml` 配置；
  旧查询参数不再控制导航视图。
- 模块和站点的交付配置均使用 `data/delivery.toml`。
  预取和 SW 配置应用到所有语言。站点声明按顶层字段整体替换，嵌套表和路由数组
  不按字段合并；修改表时须完整填写。空路由数组移除全部默认路由。
  部署参数使用 `platform.edgeone.makers`；路径特例使用
  `http.edgeone.makers` 和 `http.cloudflare.pages`，`http` 与 `sw` 独立配置。
  SW 只使用 `sw.bucket`（`versioned`、`fingerprinted`、`off`），支持路径任意位置的
  单个通配符，区分路径大小写，后声明的匹配规则优先。默认覆盖同源 GET 请求，
  包括 JSON 和 XML。按版本缓存未命中时校验 HTTP 缓存，关联资源只预热指纹 URL。
  平台 `enabled` 开关控制 Cloudflare Pages 的 `_headers`、`_redirects`
  和 EdgeOne Makers 的 `edgeone.json`；未声明的平台关闭。
  启用 SW 时生成 `sw-policy.json`，按实际匹配顺序复制 path/bucket 规则；
  关闭或停用时不输出该副本。
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
- 普通页面只在加载完成后注册 SW；预渲染页面等到激活后再注册。
  Powered by 页面自行显示 PWA 状态并提供手动检查。
  程序更新检查和激活交给浏览器，链接、刷新和历史导航保持原生行为。
  首次访问不再额外补缓存。移除 `update_check_interval`、`update_visibility_throttle` 配置。
  内容版本改由固定地址 `sw-version.json` 提供，单纯内容发布不改变 `sw.js`。
  SW 在成功导航响应后延迟 15 秒检查，`service_worker.content_check_interval`
  设置最小间隔，默认 5 分钟。新内容版本切换并清理旧内容缓存，不刷新当前页面；
  指纹资源缓存跨版本保留。waiting 程序不暂停内容检查。
  程序更新在激活前准备离线页；停用后重新启用时恢复内容版本，
  同一程序再次安装时重新准备离线页。激活时保留等待期间缓存的新版离线页，
  缺少的路径由已准备的离线页补齐。
- 列表显示日期和日期排序先读取 `lastmod`，再读取 `date`。
  Git 提交和文件系统时间不改变内容日期。

## 修复

- 已准备好的 Python 环境支持并发运行命令，不再误报安装锁冲突。
- 构建版本和浏览器预取检查接受版本 JSON 与合法的空内联规则。
- 未注册 Service Worker 时，预取诊断页仍能显示配置和运行状态。
- Cloudflare 缓存和 XML CSP 特例先删除继承的响应头，再设置新值，
  避免多个冲突值被拼接。
- 章节滚动执行时读取当前 URL 片段，避免待执行的章节滚动
  覆盖后续的“跳到正文”操作。
