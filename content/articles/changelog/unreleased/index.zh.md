---
title: 未发布
url: p/unreleased/
description: Banyan 主题和 Skill 的未发布变更。
date: 2026-11-06
lastmod: 2026-11-12
---

## 新增

- 图片墙无封面时优先居中显示站点 SVG 图标，缺少时回退 ICO；目录独立说明使用正文字号，不再重复填充标题。

- 新增 `page-collection-wall` 与 `page-collection-wall-all`：普通栏目混排目录、文章和引用，首页与普通汇总栏目通过 `wall.size.width/height` 配置固定比例、等宽或等高图片墙，通过 `details` 配置详情入口，通过 `scroll` 配置滚动方向。点击标题展开详情，点击封面进入文章；支持栏目引用去重和首页浏览来源。目录卡片以小图标区分，共用详情浮窗显示说明与文章数；父列保持紧凑导航。
- 参考站示例：首页使用风场，“文章－分类”及下级栏目使用列表。配置中保留 300 × 125 图片墙参数注释，并注明配套的图片墙 layout。

- SVG favicon 必须显式声明 32×32 默认尺寸，否则构建报错；参考站新增 GitHub 页面，头像独立于站点 favicon。第一列导航将 GitHub 放在“关于”之前，“关于”排在最后。参考站 SVG、ICO、Apple touch 和 PWA 图标统一使用鲜叶绿 `#26861C`；ICO 保留单张 32×32、32 位 DIB 图像。Powered by 的主题名称后显示与首页入口同尺寸的站点图标；仅主题版本文字链接到项目 GitHub 首页。

- RSS 订阅页提供“全部文章 + 分类订阅规则”，不再枚举所有分类。`rss-link` 读取实际全站订阅地址，`site-root` 为网址示例生成当前语言的站点前缀。

- 各语言首页的 `title` 统一提供站名；删除 `hugo.toml` 中的站名配置。浏览器标题后缀、RSS 和 `llms.txt` 使用对应语言的站名，PWA 清单使用默认语言的站名。
- 默认站点由 `defaultContentLanguage` 选择；调整语言 `weight` 不再改变 PWA 清单名称、SEO 默认语言或 404 默认语言。
- 语言选项图标改由各语言设置页的 `params.language_icon` 提供，移除 `hugo.toml` 中的语言图标配置；设置页导航图标仍使用 `params.icon`。
- 外观设置页通过 `params.appearance_icons` 声明 `auto`、`light`、`dark` 图标，支持 SVG 名称、文字和图片。
- 参考站点保留英语、简体中文和从右向左排版的阿拉伯语，移除繁体中文页面及界面字典。简体中文使用 `zh-Hans`；RSS 使用完整语言标签，Open Graph 无地区时省略可选的语言标记。
- 最低 Hugo 版本由 Module 的 `theme.toml` 声明，站点不再重复配置 `module.hugoVersion.min`。
- 使用指南和开发资料发布在 `https://banyan.swaw.com/articles/docs/`，版本说明发布在 `https://banyan.swaw.com/articles/changelog/`；源码由 Banyan 仓库的 `content/articles/docs/` 和 `content/articles/changelog/` 维护，与主题代码随同一版本发布。两者均按普通文章发布，使用 `p/` 网址，提供日期、来源链接、章节目录和 RSS。
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
  `upgrade/version/current` 从实际 Module 或 vendor 版本输出比对起点；本地源码须核实 HEAD 属于官方当前远程历史，
  无法核实时报告 `old: null`，声明版本仅作为候选。
  修复本地 Git 历史改写可能将未发布提交误报为官方版本的问题。
  本地版本识别不下载缺失的 Git 对象，包括部分克隆中的对象。
  `deploy/release/tag` 校验提交内的 Theme、Skill 版本，使用 Go 原生解析核对 Module 标识，再向 origin 原子发布配套标签，支持 `--check` 预览。
  发布不受子模块递归推送配置影响，避免报告成功却未发布主仓库标签。
  发布地址按 Git 的 origin 原生规则解析，避免重复 URL 重写导致发往错误仓库；预检使用实际推送目标。
  版本不一致或标签已存在时，按系统语言列出实际版本、文件字段或冲突标签，并提示核对已发布版本、修改提交及重试方法。
  `help` 列出 `upgrade/` 和升级需关注的四个根项。
  `help upgrade/git` 提供 Git 比对命令，以及子目录、原生 pathspec 通配符和目录排除示例；
  来源未知时按目标版本参考站点全量核对，目录统一使用路径占位符。
  同时说明完整 Skill 的配套更新与升级后验证。
  uv 和 Python 3.13 在 Skill 内隔离运行脚本和 CLI，支持站点已有 uv 项目，
  不修改系统 PATH 或 Python 注册表。
  `sync/ext` 和内容检查用 npm 按需准备 Skill 内的解析依赖，与父工作区隔离；
  站点构建不需要 npm 依赖。
- 新增 `page-collection-directory-name-only` 名称列表和产品列表，复用多列导航和排序。
  名称列表只占一列；产品分类由站点定义，产品字段显示名称、更新时间和价格，默认按更新时间倒序。
  `params.offer.version` 可保留为定义值，列表不显示，也不按它排序；`offer.value` 价值点已移除。
- Powered by 页面显示实际主题版本、Hugo 版本、站点构建信息及 PWA 状态。
  标题、说明、源码和变更记录链接由各语言 Markdown 正文维护，外链复用 `new-tab`；
  删除旧 `params.theme_changelog` 和 `params.theme_repo` 配置。
  `theme-version` 替代 `powered-by-theme`，只输出主题版本；`hugo-version` 显示实际 Hugo 版本。
  `site-status` 使用 `version`、`content`、`interval`、`policy`、`offline` 或 `status` 参数，分别输出
  本地版本、服务器版本、内容检查间隔、缓存策略、当前语言的离线页链接和 SW 状态；`interval` 的显示文字包含 `%d`。
  `content` 和 `status` 分别提供手动检查按钮，不激活等待中的 SW，也不自动刷新当前页面。
  页面维护 `params.site_status.labels`。
  预取诊断使用独立页面或正文分节，文案由 `params.prefetch_debug.labels` 维护；
  独立页面链接保留默认语言和部署子路径，其受控状态仅表示诊断页自身是否受 SW 控制。
  自行覆写该页的站点须同步当前参考正文；旧 `powered-by` 短代码和 `powered_by` 文案字段已移除。
- 浏览器检查覆盖导航、布局、语言设置、图片、预取和 PWA。
  支持 Chromium，部分检查支持 WebKit。`check/browser/site`
  自动查找代表页面，并报告未检查的范围。
- 静态检查和 HTTP 检查覆盖内容声明、HTML、站点地图、robots、LLMS、
  图片、CSP、SRI、缓存响应头和预取。提供资源体积和页面数据体积报告。
  HTML 检查也验证文章日期行、路径顺序、侧栏控制脚本和静态更新控件。
  `check/delivery` 检查生成的平台格式、指纹路径和发布文件名，不读取资源正文。
  HTTP `immutable` 或 SW `fingerprinted` 任一项即可标记指纹路径，两层独立配置。
  子目录部署使用 `--base-path` 指定 URL 前缀；路径字符和 EdgeOne 域名重定向按平台语法处理。
- `sync/ext` 同步声明的外部资源；`deploy/edgeone/sync`
  同步构建生成的部署配置。
- `deploy/cloudflare/cli` 和 `deploy/cloudflare/wrangler` 运行固定版本的
  Cloudflare CLI，透传原生参数；各自提供 `ensure [--force]` 和本地 `check`。
  普通命令按需准备依赖，授权可使用各 CLI 的原生用户凭据，
  或 Windows 凭据管理器中的共用 API Token。
  原生配置、登录凭据及存储方式由 CLI 管理，可沿用系统中同一工具的已有登录。
  `auth/token/check` 也可检查用户手工添加的凭据。
  修复资源名称和显式布尔参数值导致的凭据误选。
  `auth whoami` 与资源命令使用相同的凭据优先级。
  原生 `CF_*` API 凭据优先于已保存的 API Token；
  已设置的 `CLOUDFLARE_*` 变量优先于对应别名。
  cf 和 Wrangler 命令及授权页的登录和状态检查，分别使用固定的
  `%TEMP%/swaw/banyan/cf/` 和 `%TEMP%/swaw/banyan/wrangler/` 工作目录，
  保留目录及缓存。本地路径以这些目录为基准；文件参数用绝对路径，
  Wrangler 项目用原生 `--cwd` 指定绝对路径。
  cf 资源管理命令使用空配置；开发和构建需要实际项目配置。
- `deploy/tencent/cli` 在 Skill 独立环境中自动准备 uv/Python 和固定版本的 tccli，
  提供 `ensure [--force]` 与本地只读 `check`，透传腾讯云和 EdgeOne 原生命令。
  登录和凭据刷新强制校验 TLS 证书。
  `auth/key/check` 在本机凭据缺失时返回非零退出码。
  配置和登录沿用 tccli 原生规则；授权页说明登录凭据明文存储，
  推荐使用 Windows 保管的 API 密钥。
  tccli 命令及授权页的登录和状态检查使用固定的
  `%TEMP%/swaw/banyan/tccli/` 目录并保留缓存；本地路径用绝对路径。
- `deploy/auth/setup` 打开 Cloudflare 和腾讯云共用的本机授权页；
  页内标题为“授权管理器”，下方显示可点击的 `Powered by banyan.swaw.com` 署名；
  浏览器标签标题为“授权管理器 · Banyan”。
  各平台的 `auth/setup` 入口直接选中对应选项卡。页面支持原生登录、
  Windows 保管的 API 凭据和只读环境变量状态，识别 Cloudflare 原生 `CF_*` 别名，显示凭据优先级、
  站点原色图标，并按系统语言显示中英文；标题栏可切换语言，保留输入和进度，
  不保存语言选择，刷新后重新按系统语言显示。
  授权页采用黑白灰配色，移除面板外框，保留两栏细分隔线；
  优先级说明放在授权方式标签下方；关闭按钮放在语言切换右侧，与其同排。
  补充说明统一放在操作区或变量表格后；登录和 API Token 说明用编号列表
  列出设置步骤、授权范围和凭据保存方式。
  进入登录授权页后后台准备工具，显示准备状态并支持重试；
  准备完成后检查 cf 和 Wrangler 的已有登录，以及 tccli 原生凭据是否可用；
  刷新或重开页面会重新检查，授权按钮即时显示请求进度。
  tccli 登录与检查使用同一 profile，通过原生 STS 身份查询确认凭据可用；
  不区分已保存的登录和密钥，也不检查业务权限。
  下载和检查期间仍可设置 API Token，关闭页面会停止准备、检查和登录。
  页面不再自动超时；各 CLI 的授权超时保持原生规则。
  授权页避免使用浏览器禁用的端口。
  保存连接断开时，取消仍会在凭据写入完成后结束会话。
  窄屏上下排列，两个平台均使用 API Token 标签。腾讯云访问密钥使用
  `swban/tencent/default`；`auth/key/check` 检查本机凭据是否存在。
- 仓库、Module 和 Skill 均包含 MIT 许可证，并保留第三方许可声明。

## 调整

- 集合页先显示列表，再显示栏目标题和正文；标题和正文与名称表头对齐，收紧列表与正文、各级标题之间的间距。正文与列表共用纵向滚动，没有正文时不增加标题或留白。
- 文章的“目录与信息”按钮改用 `assets/site/icons.toml` 中的 `menu` 图标，放在标题同行的右侧；保留悬停说明、无障碍名称及原有展开和收起操作。
- 栏目页提前加载父栏目导航，缩短空白列等待时间；主内容不等待导航加载完成。
- 桌面端各列和横向画幅统一使用原生细滚动条，按钮外观跟随系统。横向滚动条与滚轮提示同步显隐，保留滚动、悬停和横向锁定行为及列间距；触屏与系统强制颜色模式使用系统默认宽度。
- 栏目标题和正文页名使用正文色并稍加粗；排序文字及日期、大小等辅助字段使用整体字号的 87.5%，随整体字号缩放。当前列表的名称表头与面包屑列表头按表头容器字号缩进 `0.3em`，排序箭头保持在文字后。保留文字行高和普通条目密度。第一列按 `weight` 排序后的首项依配色显示表头线，保持原字重。自定义配色将 `--list-header-border` 定义在 `.item-list` 中。
- 移除跟随鼠标的横向滚轮箭头，保留底部说明；悬停不进入锁定。左右方向键也可进入此共用状态，保留原生横向移动；修复页面加载后未移动鼠标时，键盘入锁后的首次滚轮仍纵向滚动正文的问题；焦点区域没有原生滚动目标时，Home/End 和 PageUp/PageDown 可直接进入，具有纵向滚动能力的列即使已到端点也保留原生按键。各列提供有名称的 Tab 焦点入口和焦点边框，面包屑列加载后才进入 Tab 顺序；Home/End 到达画幅两端，PageUp/PageDown 按列移动，宽列内每次最多移动一个视口。上下方向键、Esc、Tab、Shift+Tab、回车和空格退出，保留原生动作；空格与 Shift+空格保留原生翻页，回车与空格保留控件激活；控件与内部横向滚动容器保留自身按键。原生横向滚动条支持直接用滚轮横移，锁定期间不隐藏其颜色，系统叠加式滚动条仍可自动隐藏；修复轨道上 Shift＋滚轮可能重复横移的问题。鼠标操作时，底部导航起始边距处的简短说明在滚动、悬停滚动条或横向锁定时显示；提示文字带随主题变化的半透明底色，且不拦截页面操作。触屏操作不显示鼠标提示。站点界面字典需包含 `canvas_wheel_help`。
- 浏览器检查 `nav/sort`、`palette/contrast`、`palette/roles`、`prose/layout` 和 `canvas/layout` 须显式指定 `--page`。外观和 PWA 导航来源默认使用首页。

- 最低 Hugo 版本升级为 0.168.0。语言配置使用原生 `label` 和 `locale`，
  移除 `params.locale`。
  SW 注册脚本恢复 SRI 完整性校验。
- 应用清单固定使用标准 head 链接，移除 `params.web_app_manifest` 和手工主题提交标记。
  Powered by 与启用的 SW 使用同一内容版本，SW 从 `sw-version.json` 读取版本并切换内容缓存。
  构建版本默认使用 `v` 加时间戳；可用 `params.build.version` 显式指定，
  移除不再使用的 `version_prefix` 和 `timestamp_layout` 配置。
- 内容栏目使用普通目录和共享的 `_map.toml` 引用，列表、数量、元信息和栏目 RSS 使用同一归属，不复制正文。
  栏目名称由各站点定义。Banyan 演示用 `articles`、`articles-all`、`products` 和 `products-all`
  展示普通列表与产品列表。列表与产品示例共用一篇正文和一份 `_map.toml`；文档和变更记录也在 `articles` 下维护。保留关于页和独立的 GitHub 入口。
  `d`、`d-all`、`pr` 和 `pr-all` 由 Swaw 自行声明；“产品 - 全部”使用 `/pr-all/`。
  移除主题对特定正文根和永久链接的约定；普通页面直接填写 `url`，正文使用 `p/名称/`，语言保留各自前缀。
  移动栏目时保留 `url` 即可保持发布网址。移除 `slug` 必填要求及逐栏目永久链接配置；缺少 `url` 时提示构建错误。
  根配置启用 Hugo 原生重复输出检查，替代手写网址审计及其开关，覆盖未列出的页面。
  移除原生 taxonomy 配置和分类字段，产品列表保留 `offer`；空的 `[taxonomies]` 关闭默认分类。
  主题不拦截原生分类配置，暂未提供分类列表布局；分类 RSS 使用 Hugo 原生成员集合。
  修复汇总列表与 RSS 成员不一致、隐藏栏目列出非 HTML 页面、带点引用路径被误拒及来源网址特殊字符丢失。
  引用文件遵循 Hugo 的资源发布设置；含引用的栏目仍检查不可列出的祖先。演示文章链接到仓库源文件。
- Skill 基础工具使用 `base/<tool>`、`base/<tool>/check` 和
  `base/<tool>/ensure`。入口使用 Node，按需准备 Node/npm 和所需工具；
  Bun 保留为独立工具。移除 `base/ensure`。
  Hugo 和 Go 按需准备 Git；主题不再启用未使用的 Git 页面信息。
  GitHub CLI 在使用时准备；npm 和 npx 分别使用 `base/node/npm` 和 `base/node/npx`。
  Python 命令使用 `base/uv/python`、`base/uv/python/check` 和
  `base/uv/python/ensure`；常用帮助将 uv 标为 Python 工具管理器。
  uv 支持前置全局参数，`run` 和 `pip` 仍使用独立的 Python 环境。
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
  自实现等待异步导航和排序完成后只初始化一次，避免慢速加载时漏掉面包屑列链接；保留页面内去重，移除会话去重。
  诊断页提供单页机制选择、重载测试和发送状态；参考页使用英语，站点通过 `params.prefetch_debug.labels` 维护界面文字。
  未配置图标使用默认策略。
  预取体积报告移除无效的旧 URL 计数。
- 来源和排序参数 `from`、`sorts` 使用 URL 的 `#` 后片段，章节定位与这些状态共存。
  `sorts` 统一记录各面包屑列和主列表的排序；生成链接时省略默认值和尾部默认项，其他默认位置用 `_` 保留。移除独立的 `sort`，不读取或迁移旧字段。
  各列使用自己的默认排序，主列表排序后同步更新面包屑列链接，新标签打开也保留最新排序。面包屑列表头只显示排序字段与方向；父列对应条目和根入口保留已展开栏目的当前排序。
  浏览器后退和前进会恢复来源和各列排序。
  分类和聚合列表页排序不再生成冗余的 `from`，文章链接仍保留所需的非默认来源。
  移除 `navigation-state-default.toml` 配置；
  旧查询参数不再控制导航视图。
  面包屑列改为加载 `/site/navigation/` 下共享的指纹 `.txt` HTML 片段；
  根导航、栏目主列表和正文仍保留 HTML，禁用 JavaScript 时可继续访问。
- 站点根完整 `assets/site/delivery.toml` 是交付配置的唯一来源，
  以 Banyan 根参考文件为起点并保留本站策略值。
  Module 和传统主题目录不再提供交付配置，不合并或继承 Module 配置。
  预取和 SW 配置应用到所有语言。站点维护完整的有序路由，空数组表示不声明路由。
  URL 重定向使用同一文件顶层的 `[[redirects]]`，按声明顺序输出；省略表示无规则。
  Banyan 参考文件只提供注释示例。
  主题只读取这份交付配置，不再禁止站点自有模板使用同名 `params` 或其他数据文件。
  HTTP 头名接受标准 token 字符，仍检查控制字符、类型和重名。
  交付检查不按文件格式限制普通附件；样式检查只检查 HTML 实际加载的 CSS。
  部署参数使用 `platform.edgeone.makers`；路径特例使用
  `http.edgeone.makers` 和 `http.cloudflare.pages`，`http` 与 `sw` 独立配置。
  SW 只使用 `sw.bucket`（`versioned`、`fingerprinted`、`off`），支持路径任意位置的
  单个通配符，区分路径大小写，后声明的匹配规则优先。默认覆盖同源 GET 请求，
  包括 JSON 和 XML。按版本缓存未命中时校验 HTTP 缓存，关联资源只预热指纹 URL。
  平台 `enabled` 开关控制 Cloudflare Pages 的 `_headers`、`_redirects`
  和 EdgeOne Makers 的 `edgeone.json`；未声明的平台关闭。
  启用 SW 时生成 `sw-policy.json`，按实际匹配顺序复制 path/bucket 规则；
  关闭或停用时不输出该副本。
  SW 为 `enable` 时，每种已启用语言必须发布 HTML 离线页；`off` 和 `disable` 允许缺页。
  移除未使用的 `/icon/*` 不可变缓存规则。
- 站点地图默认收录已渲染且允许索引的 HTML 页面，不受 `build.list` 影响。
  在内容前置配置中用原生 `sitemap.disable` 排除页面，
  移除 `params.sitemap.include_pages`。禁止索引的页面和被排除的译文
  不进入站点地图条目或其他语言链接。
  各语言 `llms.txt` 使用同一页面集合，按栏目和分类分组，复用已有标题与描述。
  `check/llms` 检查漏项、多项、重复地址和失效索引链接。
  索引位于各语言首页路径下，并链接其他语言索引；根索引提供默认语言目录，
  不再额外生成默认语言路径下的副本。
- 主题从 `module/` 发布，新站点从完整根参考站点起步。
  所有页面由站点根 `content/` 维护，包括 Powered by 和预取诊断，参考站点先保留全部页面。
  内部页放在 `content/_res/`，共用 `_index.md` 隐藏其导航和站点发现入口。
  离线页使用独立的 `page-offline`，保留正文、主题和重试，不加载导航、SW 管理或预取脚本。
  已有站点按需从参考站点补入这些页面；删除页面后 Module 不回填，不再提供内容默认页。
  布局、脚本和样式仍由 Module 提供。
  文章模板由站点根 `archetypes/banyan.md` 维护，Module 和主题不再提供。
  新建文章统一使用 `--kind banyan`，移除重复的 `blog` 模板。
  favicon、四个 PWA PNG 图标、完整 manifest 模板和可选品牌素材由根 `assets/site/` 维护，
  Module 和传统主题目录不再提供这些文件；已有站点使用主题前须补齐根
  `assets/site/`。站点直接维护 `assets/site/manifest.webmanifest.tmpl`，
  Module 只读取并执行，产物为 `/site/site.<hash>.webmanifest`；图像发布到 `/site/*`。
  完整配色由站点维护，Module 不再提供 `css/theme.css`。参考配色统一放在根 `assets/site/`。
  默认选择 `site/theme.css`：选中与悬停同色，浅色混入前景 4%、深色 10%，采用直角和 2px 当前项起始边线。未选中的单色列表图标使用 70% 不透明度，当前项、文字图标和彩色图片保持原样。非当前排序箭头使用 50% 不透明度，当前箭头保持 100%。
  `site/theme.high-contrast.css` 的选中与悬停使用同一高对比底色，文字和单色图标同步反色，选中名称使用 700 粗体，条目采用直角。
  `page-home` 首页正文通过 `home-art` 引用 `content/_res/home-art/<主题>/` 下的隐藏叶子包。
  各语言艺术页维护场景文字和参数，包内 CSS、JS 由 `params.styles` 和 `params.scripts` 选择；
  艺术包通过 `params.template` 选择包内 `scene.html.tmpl`，场景计算、HTML、CSS 和 JS 随包维护，新增场景无需修改 Module；复制后的包使用自己的资源发布路径。模板可通过 `.Content` 放置 Markdown 正文。宿主首页的 `params.show_navigation` 控制第一列导航；颜色由所选配色控制。
  favicon 源统一放在 `assets/site/`；`favicon.link.svg` 优先于 `favicon.link.ico`，
  只为选中的文件输出指纹图标链接。`favicon.ico` 独立发布为固定根地址，不自动追加链接。
  至少需要一种 favicon；四个 PWA PNG 和 manifest 模板仍必填。
  授权页从同一目录依次选择链接 SVG、链接 ICO、固定 ICO；无图时不显示 Logo。
  站点还自行维护 `assets/site/icons.toml` 和 `assets/i18n/` 界面字典。
  项目 `hugo.toml` 原生挂载 `assets/i18n` 到 `i18n`。
  按需维护 `assets/site/external-resources.yaml`。
  Module 和传统主题目录不提供这些配置或界面字典，已有站点须从根参考站点补齐。
  增删语言时同步修改 `hugo.toml`、界面字典和所需的内容译文。
  各站点自行维护完整 `hugo.toml`，移除 Module 默认配置。
  仓库根配置提供示例，包含 LLMS 输出定义、语言 locale 和显式配色。
  演示站声明 `EN`、`简`、`ع` 作为语言标记，支持阿拉伯语从右向左布局。
- 构建和预览使用原生 Hugo 命令。发布使用原生 Git 和 GitHub CLI 命令。
- 由 Hugo 构建并压缩 JavaScript，在构建阶段生成 CSP 和部署响应头。
  站点必须设置 `minify.disableJS = true`，以保持内联脚本与 CSP 哈希一致。
- 普通页面只在加载完成后注册 SW；预渲染页面等到激活后再注册。
  Powered by 页面自行显示 PWA 状态并提供手动检查。
  程序更新检查和激活交给浏览器，链接、刷新和历史导航保持原生行为。
  首次访问不再额外补缓存。移除 `update_check_interval`、`update_visibility_throttle` 配置。
  内容版本改由固定地址 `sw-version.json` 提供，单纯内容发布不改变 `sw.js`。
  SW 在导航时启动独立的后台检查，`sw.content_check_interval`
  设置最小间隔，默认 5 分钟。新内容版本切换并清理旧内容缓存，不刷新当前页面；
  指纹资源缓存跨版本保留。waiting 程序不暂停内容检查。
  程序更新在激活前准备离线页；停用后重新启用时恢复内容版本，
  同一程序再次安装时重新准备离线页。激活时保留等待期间缓存的新版离线页，
  缺少的路径由已准备的离线页补齐。新程序激活后重置内容检查时间，
  下一次页面导航立即后台检查版本，无需等待原检查间隔。
- 列表显示日期和日期排序先读取 `lastmod`，再读取 `date`。
  Git 提交和文件系统时间不改变内容日期。

## 参考站示例

- 新增 `minimal` 首页艺术包，提供英文、中文、阿拉伯文参数与 Markdown 正文，以及最小 HTML 模板和 CSS；无需 JS。默认首页仍使用风场。新增示例无必需迁移。

## 升级迁移

- 使用图片墙旧配置的站点 → 栏目或首页 `_index*.md` 的 `params.wall` → 将 `layout` 和数值 `size` 合并为 `size.width/height`：等高为 `auto/原 size`，等宽为 `原 size/auto`，固定比例填写对应宽高；将 `caption`、`controls` 合并为 `details: title|overlay|overlay-hover`，移除旧字段。

- 使用艺术包的站点 → `content/_res/home-art/<主题>/index*.md` 和包内模板 → 设置 `params.template: scene.html.tmpl`，移除正文中的场景短代码；将场景 HTML 和计算迁入该模板。文字及 HTML 属性值使用 `htmlEscape`；需要正文时由模板输出 `.Content`。风场可复制当前参考包的模板。

- 使用风场艺术包的站点 → `content/_res/home-art/<主题>/index*.md` → 将 `params.home_signals` 改为 `params.signals`，`params.home_signal_*` 改为 `params.signal_*`，`params.home_wind_field_start_offset_rem` 改为 `params.wind_field_start_offset_rem`；信号对象使用 `name`、`url`、`primary`，将 `title` 或 `label` 合并到 `name`，将 `href` 改为 `url`。
- 自行维护风场样式或模板覆写的站点 → 艺术包 CSS/JS、`assets/site/theme*.css` 和 `layouts/` → 将风场类名 `.page-home`、`.page-home__*`、变量 `--page-home-*` 和行为标记 `data-page-home-signal` 改用当前参考艺术包的 `home-art-wind` 名称；其中 `--page-home-wind-field-*` 改为 `--home-art-wind-field-*`，`--signal-*` 改为 `--home-art-wind-signal-*`。将专用短代码与计算模板中的定制合并到艺术包的 `scene.html.tmpl`，删除旧覆写。
- 自行覆写页面动作的站点 → `layouts/`、`assets/js/` → 返回脚本改用 `pages/back.js`，重载脚本改用 `pages/reload.js`。
- 自行覆写面包屑组件的站点 → `layouts/`、`assets/js/`、自定义 CSS → 同步当前 Module 的 `breadcrumb-*` 脚本与 `.breadcrumb-navigation`、`.breadcrumb-column` 样式；文章目录链样式使用 `.document-meta__row--breadcrumb`、`.document-meta__breadcrumb`。构建模型覆写使用 `feature-browse/navigation/breadcrumb/`，SEO 模板覆写使用 `system-metadata/seo/breadcrumb-list.html`。列标记使用 `data-breadcrumb-column`、`data-breadcrumb-column-path`、`data-breadcrumb-collection-href`；排序和失败标记使用 `data-breadcrumb-sort-toggle`、`data-breadcrumb-failed`；加载标记使用 `data-breadcrumb-pending`、`data-has-breadcrumb-columns`。`params.slots` 中的 `breadcrumb` 无需修改。

- 使用旧站点状态控件的站点 → 页面正文、front matter 和同路径模板覆写 → 将 `site-update` 改为 `site-status`，将 `params.site_update.labels` 改为 `params.site_status.labels`；模板覆写使用当前 Module 的资源路径和 DOM 标记，不保留旧名兼容。

- 使用 `favicon.link.svg` 的站点 → `assets/site/favicon.link.svg` → 设置 `width="32" height="32"`，保留与路径匹配的 `viewBox`；引用处仍可指定其他显示尺寸。

- 本次产品列表及横向键盘操作调整无必需迁移。已有 `params.offer.version` 定义值可保留。

## 修复

- 统一图片墙缩放：size 为最大尺寸，不放大；规则行列最多缩小 20% 以增加一行或一列，否则留白。单卡放不下时继续缩小适配；等高纵向布局只缩小超宽卡片，不再连带缩小整墙。图片墙封面统一发布到 `/media/content/`，使用已有指纹缓存规则。

- 打印时各列适应纸张宽度，长代码和表格内容换行，避免右侧内容被裁切。独立代码行号列在打印时隐藏，避免与换行后的代码错位。
- 正文标题与引用、表格、代码和图片保留文字行框的间距补偿，列表正文使用紧凑间距。响应式图片与普通图片使用相同间距，并与代码、引用的段落间距对齐；行内小图不再触发图片段落间距。文章标题间距不再受元信息或 JavaScript 开关影响；引用、代码、表格和图注字号随基础字号缩放。

- 站内链接先解析页面与附件，再补齐部署子路径；默认语言链接使用实际发布目录，链接中的裸百分号不再中断构建，行内链接不再插入多余空白。
- 默认语言仅发布 RSS、其他语言发布 HTML 时，共享交付文件仍正常生成。
- 栏目 URL 校验和共享导航正确处理部署目录中的字面百分号；`a%20b` 这类百分号后跟两位十六进制字符的字面目录名仍不支持，构建会明确报错。
- HTML 检查正确读取属性引号中的 `>`，并跳过属性值内的伪属性，避免误报有效链接和锚点或漏检坏链接。资源路径解析正确处理含中文、空格或百分号的部署前缀。
- 集合字段从首帧起使用固定宽度，长文字在字段内裁切，不缩小字号；提示保留完整文字。
  自定义列表样式使用 `item-list`、`list-item`、`item-field` 和 `item-control`，
  配色使用 `--item-*` 颜色变量，字段宽度使用 `--item-*-inline` 和 `--item-field-gap`。

- 横向画幅的末端留白适配可见阅读列，禁用 JavaScript 时也正常；修复手机上滚动正文后元信息有时无法展开。根导航和面包屑列的列表适应纵向滚动条占用的宽度，避免出现内部横向滚动条。代码块到达左右边界时，允许浏览器将横向滚动传递给外层画幅；实际交接由浏览器决定。
- 生成 Cloudflare `_headers` 时拒绝以 `#` 开头的响应头名称，避免被静默当作注释忽略。
- 关闭可见元信息时，文章结构信息仍正常输出。
- 默认、高对比度和 Rose 配色统一取消导航首项、列表头及全部 `h1` 的底线和占位；各配色 CSS 提供恢复线条的注释示例。列表线和 `h1` 底线可分别定制。
  `.item-list` 的 `--list-header-border` 与 `.prose` 的 `--prose-heading-border` 改用完整声明，如 `1px solid #888`；`none` 取消线条和占位，`1px solid transparent` 保留占位。自有配色需同步修改原来的纯颜色值。集合布局检查接受无边框、透明边框和自定义列表头边框。
- 已保存的外观偏好无效时，从首帧开始跟随系统主题。
- 已准备好的 Python 环境支持并发运行命令，不再误报安装锁冲突，并接受管理目录内的 uv Python 别名。
- 构建版本和浏览器预取检查接受版本 JSON 与合法的空内联规则。
- 未注册 Service Worker 时，预取诊断页仍能显示配置和运行状态。
- Cloudflare 缓存和 XML CSP 特例先删除继承的响应头，再设置新值，
  避免多个冲突值被拼接。
- 章节滚动执行时读取当前 URL 片段，避免待执行的章节滚动
  覆盖后续的“跳到正文”操作。
