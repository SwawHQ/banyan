swban - Banyan 工具 (Windows x64)

ensure 复用合格工具，缺少时下载。--force 使用便携版。

  swban help [en|zh]           #查看帮助；默认按系统语言
  swban ensure [--force]       #准备 CLI；选 Bun 或 Node

  swban bun [原生参数...]      #运行 Bun；--help 查看原生帮助
  swban bun.check              #检查所选 Bun
  swban bun.ensure [--force]   #准备 Bun

  swban node [原生参数...]     #运行 Node；--help 查看原生帮助
  swban node.check             #检查所选 Node
  swban node.ensure [--force]  #准备 Node；便携版含 npm/npx
  swban npm [原生参数...]      #运行 npm；--help 查看原生帮助
  swban npx [原生参数...]      #运行 npx；--help 查看原生帮助

  swban git [原生参数...]      #运行 Git；help 查看原生帮助
  swban git.check              #检查所选 Git
  swban git.ensure [--force]   #准备 Git

  swban gh [原生参数...]       #运行 GitHub CLI；--help 查看原生帮助
  swban gh.check               #检查所选 GitHub CLI
  swban gh.ensure [--force]    #准备 GitHub CLI；按需安装

  swban go [原生参数...]       #运行 Go；help 查看原生帮助
  swban go.check               #检查所选 Go SDK
  swban go.ensure [--force]    #准备 Go SDK

  swban hugo [原生参数...]     #运行 Hugo；--help 查看原生帮助
  swban hugo.check             #检查所选 Hugo
  swban hugo.ensure [--force]  #准备 Hugo Extended

版本配对（站点默认当前目录）：
  swban check/module [站点]    #检查 Skill 与实际解析的 Module 版本

内容声明（站点默认当前目录）：
  swban check/content/translation-placeholder [站点]  #翻译占位页声明
  swban check/content/share-image [站点]              #分享图字段声明

构建产物（目录默认 public）：
  swban check/html/metadata [目录]     #页面元数据与文章日期行
  swban check/html/headings [目录]     #可索引页面的标题数量
  swban check/html/jsonld [目录]       #结构化数据格式
  swban check/html/scripts [目录]      #脚本引用、加载边界与页面控件
  swban check/html/styles [目录]       #样式引用与加载边界
  swban check/html/breadcrumb [目录]   #面包屑数据与标记
  swban check/sitemap [目录]           #sitemap 与索引状态
  swban check/robots [目录]            #robots.txt 声明
  swban check/llms [目录]              #llms.txt 与入口链接
  swban check/csp [目录]               #内联哈希与生成的 CSP
  swban check/sri [目录]               #外部脚本完整性哈希
  swban check/build-version [目录]     #页面与 SW 构建版本
  swban check/prefetch/payload [目录]  #页面预取数据与脚本
  swban check/prefetch/rules [目录]    #共享预取规则与生成头
  swban check/img/responsive [目录]    #响应式图片交付
  swban check/img/share [目录]         #生成分享图的格式与体积
  swban check/img/icons [目录]         #图片图标引用与尺寸

HTTP 响应：
  swban check/http/security <URL>     #实际 HTTP 安全头
  swban check/http/cache <URL>        #实际资源缓存头
  swban check/http/speculation <URL>  #预取响应头与规则 JSON

浏览器检查（目录默认 public；追加 --help 查看全部参数）：
  swban ensure/browser                                                                         #准备 Playwright/Chromium
  swban ensure/browser.webkit                                                                  #准备 Playwright/WebKit
  swban check/browser/site [目录] [--updates] [--site 站点]                                    #自动选页批量检查；可临时构建 SW 新版
  swban check/browser/home [目录] [--headed] [--trace]                                           #首页加载与运行；Chromium
  swban check/browser/home.webkit [目录] [--headed] [--trace]                                    #首页加载与运行；WebKit
  swban check/browser/csp [目录] [--page path] [--headed] [--trace]                              #CSP 执行；Chromium
  swban check/browser/csp.webkit [目录] [--page path] [--headed] [--trace]                       #CSP 执行；WebKit
  swban check/browser/prefetch/rules [目录] [--page path] [--expect inline|off] [--eager rules]  #浏览器实际接收并解析规则；Chromium
  swban check/browser/prefetch/overlap [目录] --page path                                        #选择原生机制后不发送自实现预取；Chromium
  swban check/browser/prefetch/debug [目录] --page path                                          #预取诊断面板与页面负载一致性；Chromium
  swban check/browser/palette/contrast [目录] [--page path] [--min N]                            #正文与代码对比度；Chromium
  swban check/browser/palette/contrast.webkit [目录] [--page path] [--min N]                     #正文与代码对比度；WebKit
  swban check/browser/palette/roles [目录] [--page path]                                         #派生配色与覆盖；Chromium
  swban check/browser/appearance [目录] [--page path] [--from path]                              #外观偏好与同步；Chromium
  swban check/browser/appearance.webkit [目录] [--page path] [--from path]                       #外观偏好与同步；WebKit
  swban check/browser/language/choices [目录] [--page path]                                      #原生语言链接与可访问选择；Chromium
  swban check/browser/language/return [目录] --from path --to code [--page path]                 #语言返回、缺失翻译与状态隔离；Chromium
  swban check/browser/language/bfcache [目录] --from path --to code [--next code]                #真实 BFCache 恢复后的语言返回；Chromium
  swban check/browser/settings/url [目录] --page path                                            #设置页保留未使用的 URL 和历史数据；Chromium
  swban check/browser/settings/history [目录] --from path --pages paths                          #设置链、原生新标签页和后退；Chromium
  swban check/browser/pwa/panel [目录] --page path --from path [--widths pixels]                 #更新面板显示、本地化与历史；Chromium
  swban check/browser/pwa/offline [目录] [--page path]                                           #真实 SW 注册、首次缓存与离线重载；Chromium
  swban check/browser/pwa/check [目录] --next 目录 [--page path] [--from path]                     #手动检查、离线重试与隐藏控件；Chromium
  swban check/browser/pwa/activate [目录] --next 目录 [--page path] [--from path]                  #链接激活、缓存更新与阅读页保留；Chromium
  swban check/browser/pwa/native [目录] --next 目录 [--page path] [--from path]                    #刷新、历史、锚点和新标签页保留等待更新；Chromium
  swban check/browser/pwa/cancel [目录] --next 目录 [--page path] [--from path]                    #后续锚点取消待执行的更新导航；Chromium
  swban check/browser/pwa/timeout [目录] --next 目录 [--page path] [--from path]                   #激活超时仍导航，保留缓存；Chromium
  swban check/browser/pwa/error [目录] --next 目录 [--page path] [--from path]                     #激活异常仍导航，保留缓存；Chromium
  swban check/browser/pwa/language [目录] --next 目录 --to code [--page path]                      #等待更新时语言链接仍可用；Chromium
  swban check/browser/pwa/disable [目录] --next 目录 [--page path]                                 #禁用 SW，清理主题状态并保留其他数据；Chromium
  swban check/browser/nav/tabs [目录] --page path [--selector css]                               #原生新标签页与 opener 隔离；Chromium
  swban check/browser/nav/roots [目录] --from path --pages paths                                 #根入口点击、选中与原生历史；Chromium
  swban check/browser/img/load [目录] --page path [--selector css]                               #图片显示、加载与解码；Chromium
  swban check/browser/nav/sort [目录] [--page path]                                              #名称/日期排序与来源导航；Chromium
  swban check/browser/nav/anchors [目录] --page path                                             #原生锚点与跳到正文；Chromium
  swban check/browser/nav/anchors.webkit [目录] --page path                                      #原生锚点与跳到正文；WebKit
  swban check/browser/nav/keyboard [目录] [--page path]                                          #列间键盘顺序；Chromium
  swban check/browser/nav/keyboard.webkit [目录] [--page path]                                   #列间键盘顺序；WebKit
  swban check/browser/breadcrumb/sort [目录] --page path [--column path]                         #路径列排序、节点复用与预取标记；Chromium
  swban check/browser/breadcrumb/isolation [目录] --page path                                    #路径列与正文排序隔离；Chromium
  swban check/browser/breadcrumb/source [目录] --page path --column path --article path          #静态与运行时来源链接；Chromium
  swban check/browser/breadcrumb/header [目录] --page path [--column path]                       #路径列标题、排序可见性与间距；Chromium
  swban check/browser/collection/layout [目录] --page path [--article path]                      #名称列宽、表头与行对齐；Chromium
  swban check/browser/collection/style [目录] --page path --collection path [--choices path]     #选中、悬停与焦点样式；Chromium
  swban check/browser/prose/layout [目录] [--page path]                                          #正文链接、列表、引用与表格隔离；Chromium
  swban check/browser/prose/layout.webkit [目录] [--page path]                                   #正文链接、列表、引用与表格隔离；WebKit
  swban check/browser/aside/toggle [目录] --page path [--touch]                                  #侧栏开合、焦点与阅读位置；Chromium
  swban check/browser/aside/toggle.webkit [目录] --page path [--touch]                           #侧栏开合、焦点与阅读位置；WebKit
  swban check/browser/aside/chapters [目录] --page path                                          #章节、锚点与历史导航；Chromium
  swban check/browser/aside/chapters.webkit [目录] --page path                                   #章节、锚点与历史导航；WebKit
  swban check/browser/aside/layout [目录] --page path                                            #侧栏位置、宽度与换行；Chromium
  swban check/browser/aside/layout.webkit [目录] --page path                                     #侧栏位置、宽度与换行；WebKit
  swban check/browser/aside/style [目录] --page path                                             #侧栏控件样式；Chromium
  swban check/browser/aside/style.webkit [目录] --page path                                      #侧栏控件样式；WebKit
  swban check/browser/aside/print [目录] --page path                                             #打印正文与元信息；Chromium
  swban check/browser/aside/print.webkit [目录] --page path                                      #打印正文与元信息；WebKit
  swban check/browser/canvas/layout [目录] [--page path] [--height px]                           #声明列宽、间距与文档画幅；Chromium
  swban check/browser/canvas/layout.webkit [目录] [--page path] [--height px]                    #声明列宽、间距与文档画幅；WebKit
  swban check/browser/canvas/touch [目录] --page path --next path                                #原生触摸拖动、链接与历史；Chromium
  swban check/browser/canvas/scroll [目录] --page path                                           #画幅平移与列独立滚动；Chromium
  swban check/browser/canvas/scroll.webkit [目录] --page path                                    #画幅平移与列独立滚动；WebKit
  swban check/browser/canvas/scrollbar [目录] --page path [--touch]                              #滚动条活动与缩放；Chromium
  swban check/browser/canvas/scrollbar.webkit [目录] --page path [--touch]                       #滚动条活动与缩放；WebKit
  swban check/browser/canvas/history [目录] --page path --next path                              #原生历史恢复与原位排序；Chromium
  swban check/browser/canvas/history.webkit [目录] --page path --next path                       #原生历史恢复与原位排序；WebKit
  swban check/browser/canvas/open [目录] --from path --page path [--touch] [--drag px]             #打开文章、保留来源排序与历史；Chromium
  swban check/browser/canvas/open.webkit [目录] --from path --page path [--touch]                #打开文章、保留来源排序与历史；WebKit
  swban check/browser/canvas/first-paint [目录] --page path [--root path|none]                   #文章与集合页首屏、预留列；Chromium
  swban check/browser/canvas/first-paint.webkit [目录] --page path [--root path|none]            #文章与集合页首屏、预留列；WebKit

体积报告（目录默认 public，排行默认前 8 项）：
  swban report/size/html [目录] [--top N]           #页面与首次加载体积
  swban report/size/js [目录] [--top N]             #JS 体积、引用与重复
  swban report/size/assets [目录]                   #全部文件数量与体积
  swban report/payload/breadcrumb [目录] [--top N]  #面包屑数据体积
  swban report/payload/prefetch [目录] [--top N]    #预取数据体积

资源与配置同步：
  swban sync/ext [id...]     #同步声明的外部资源；默认全部

EdgeOne 配置同步（目录默认 public）：
  swban deploy/edgeone/sync [目录]  #复制生成配置到站点根

Hugo 常用命令：
  swban hugo --minify --gc --cleanDestinationDir         #生产构建
  swban hugo --minify --destination ./preview            #指定输出目录
  swban hugo server -D --disableFastRender --port 13241  #开发预览；端口 13241

Git 常用命令：
  swban git tag v0.1.0 HEAD                                                      #标记 Skill 发布版本
  swban git tag module/v0.1.0 HEAD                                               #在同一提交标记 Module 版本
  swban git push --atomic --no-follow-tags origin tag v0.1.0 tag module/v0.1.0     #一并推送配对标签

GitHub 常用命令：
  swban gh auth login --web                                 #登录 GitHub
  swban gh auth status                                      #检查登录状态
  swban gh release create <tag> --verify-tag --notes <URL>  #链接版本记录
