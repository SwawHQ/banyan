# UI 命名与职责

名称按当前职责组织，不再描述已经退役的主菜单、顶部面包屑和下拉布局。

| 实体 | 名称与位置 |
| --- | --- |
| 第一列根入口 | `browse/root-navigation.js`、`feature-browse/navigation/root/render.html`；由真实页面的 `root_nav` 声明产生 |
| 可见路径列 | `browse/path-render.js`、`path-navigation.css`；容器 `.path-columns`、单列 `.path-column` |
| 集合页面 | `layouts/page-collection.html`、`feature-browse/collection/render-page.html`；列表内容由 `feature-browse/collection/render.html` 渲染 |
| 集合条目 | `collection-item.css` 负责条目和状态，`collection-grid.css` 负责 `.collection-list` 公共网格，`collection-table.css` 负责 `--directory`／`--all`／`--products` 列定义 |
| 文档元信息与章节目录 | `document-aside.css`；负责 `.document-meta`、`.document-toc` 和辅助列内的列表条目适配，不属于正文组件 |
| 正文右侧辅助列 | `page-shell.css` 控制 `.document-aside` 的尺寸与独立纵向滚动，`document-aside.css` 控制列内内容 |
| 正文中的有序／无序列表 | `prose-lists.css`；只作用于正文 `ul/ol/li` |
| 首页 | `layouts/page-home.html`、`entry-page-home/model.html`、`page-home.css`；交互入口为 `js/pages/home.js`，风向袋为 `assets/page-home/windsock.svg` |
| 区域开关 | `slot_flags`、`slotFlags`；值是布尔值，不再是 fragment 来源 |
| 浏览来源与排序状态 | `browse/navigation-state.js`、`browse/navigation-state.contract.js` |
| 语言和外观偏好 | `preferences/language-page.js` 仅用于选择页；`preferences/language-return.js` 与 `preferences/theme.js` 负责跨页面行为；静态选项和返回链接在模板输出 |
| PWA 状态与检查 | `updates/page.js` 连接页面、更新引擎与状态呈现；模板为 `feature-updates/panel.html`、`feature-updates/labels.html` |

## 内容声明

集合页统一声明 `layout: page-collection`。例如更新目录只显示名称：

```yaml
layout: page-collection
list: name
```

`layout` 选择页面模板，`list` 选择列表展示；集合成员来自 Hugo 的目录／分类结构，或 `aggregate` 指向的集合。更名没有改变这三个职责，也没有提供 `article-list` 旧模板别名。根项目、主题内容和 `exampleSite` 均已迁移到当前命名。

## 路径数据与显示

服务端的 `feature-browse/navigation/path/` 与浏览器端的 `browse/path-entry.js`、`browse/path-render.js`、`browse/breadcrumb-*.js` 共同处理结构路径、浏览来源及恢复。`system-metadata/seo/breadcrumb.html` 输出 SEO 的 BreadcrumbList；`slots.breadcrumb` 和网址 `from / sort / sorts` 保持既有约定。

可见路径列通过 `renderPathColumns()` 装配，通过 `renderPathColumn()` 重绘单列。条目模块从页面边界已解码的 payload 生成行数据。路径模型中 `column_items` 表示该列的兄弟条目，行的选中状态只使用 `current`；不再读取 `highlighted`、`selected` 别名。输入参数 `selected_href` 等仍明确表示用哪个地址寻找当前行。

首页、普通页面、分类法分别使用 `model-home`、`model-page`、`model-taxonomy` 生成结构路径；`model.html` 保留按页面类型选择模型的显式分支，不再使用没有对应手动模式的 `-auto` 后缀。

`page-shell.css` 中，`--main-column-inline` 控制主内容宽度，`--navigation-column-inline` 统一控制第一列、路径列与列表名称列的宽度，`--document-aside-inline` 独立控制辅助列（桌面 30rem，最多占一个可视区域），`--page-shell-gap-inline` 统一控制画幅列间距。辅助列与导航列从同一顶部开始，正文标题间距由 `prose-base.css` 控制。各屏幕宽度使用同一套画幅；不再给相同尺寸建立 rail／path 转发变量。

## CSS 源码与发布名

`assets/css/` 保持扁平，现有 19 个源码文件。layouts 的 `entry-*`、`feature-*`、`system-*` 表达模板调用边界；CSS 按视觉职责命名，不复制模板目录层级，也不要求一个模板对应一个样式文件。

| 模板职责 | CSS 归属 |
| --- | --- |
| `baseof.html` 与 `system-ui/page-slots.html` | `theme.css`、`base.css`、`page-shell.css`：主题、默认值、整体画幅和各列滚动 |
| `system-ui/icon/`、`system-ui/list/`、`system-ui/choice/` | `icons.css`、`collection-item.css`、`collection-grid.css`：图标、共享条目及状态、列表网格与公共列头 |
| `feature-browse/collection/` | `collection-table.css`：多列字段和 directory／all／products 列定义 |
| `feature-browse/navigation/path/` 与 `browse/path-render.js` | `path-navigation.css`：路径列排列、待绘制状态、路径列头和共享列表在路径列内的适配 |
| `feature-document/aside.html`、`meta.html`、`toc.html` | `document-aside.css`：元信息、章节目录及列内条目适配；列尺寸和滚动仍由 `page-shell.css` 统一控制 |
| `feature-document/render-page.html` 与 Markdown 渲染 | 七个 `prose-*`：基础、行内、列表、引用、图片、代码、表格；所有正文页共用 |
| `page-home.html` 与 `entry-page-home/` | `page-home.css`：首页场景 |
| `feature-updates/panel.html`、`404.html` | `updates-panel.css`、`not-found.css`：各自的小型呈现规则 |

公共装配入口 `system-ui/page-styles.html` 按“基础与画幅 → 共享列表 → 功能适配”排序。共享文件定义组件默认外观，路径列和辅助列的特有规则放在各自文件。`collection-*` 也供语言、外观与章节目录复用，它表示一套列表呈现，不限定为集合页面；无需随消费者增加重复样式或更换为模板层级前缀。

源码文件表达维护职责，发布文件表达缓存边界。`baseof.html` 通过上述入口装配公共 `page.css`；`feature-document/styles.html` 将七个 `prose-*` 源码合并成一个 `prose.css`，由确实输出 `.prose` 的页面加载；`updates-panel.css` 与 `not-found.css` 虽保留独立源码归属，也进入 `page.css`。首页另发 `page-home.css` 和三种语言各自的场景样式，因此完整生产构建共有 6 个 CSS 资源。

## 首页命名与资源

首页内部统一使用 `page-home`：根节点 `.page-home`、子元素 `.page-home__*`、页面变量与动画 `--page-home-*`／`page-home-*`、信号控件 `data-page-home-signal` 与选中标记 `data-page-home-signal-selected`。模板的 `pageHomeModel` 返回 `signals` 与 `sceneCSS`，后者发布为 `page-home-scene.<page-key>.css`；单个信号的局部参数为 `--signal-lift`、`--signal-duration`、`--signal-delay`。

JS 的 `pageHomes` 表示首页根节点，`scenePauseStates` 表示场景暂停原因，`selectedSignalControl` 表示选中的信号控件；操作使用 `setScenePaused`、`initSignalButtons`、`setSignalSelected`、`clearSelectedSignal` 等具名函数。`pages/home.js` 的目录已经表达页面归属，不重复添加 `page-` 前缀。

风向袋是首页私有的 SVG 资源，由 `resources.Get "page-home/windsock.svg"` 直接读取并内联；无需为它维护三个语言的隐藏内容页面。站点如需定制，可在根目录的 `assets/page-home/windsock.svg` 覆盖同名主题资源。

内容字段 `brand_line`、`home_signals` 与 `home_signal_*`／`home_wind_field_start_offset_rem` 保留既有语义；Hugo 原生的 home Kind、`home.llms.txt`、导航的 `model-home.html` 也不属于这次内部命名迁移。

## 更新模块

`feature-updates/labels.html` 返回 Powered by 页提供的文案，`feature-updates/panel.html` 负责 HTML，`assets/css/updates-panel.css` 负责呈现，`assets/js/updates/page.js` 负责读取本页静态文案并绑定状态与操作。该小型 CSS 源码仍由公共 `page.css` 装配；页面脚本只由 `page-powered-by.html` 加载。页面通过 `window.BanyanServiceWorkerManagerRuntime.updates.subscribe(listener)` 接收 `{status, latencyMs, controlled}`，通过 `check()` 只检查新版，永不激活或重载。`pwa/navigation.js` 只在普通站内同标签页链接跳转前调用 `activate()` 激活已就绪版本，然后直接打开目标地址；激活操作本身不重载页面。引擎不查询页面控件或加载文案，刷新、历史和其他标签页不触发自动重载。未启用 SW 时检查页显示不可用。

## 样式类与行为标记

`.collection-panel` 是一列宽的页面容器；其中的 `.collection-list` 才是列表。每个单元格使用 `.collection-cell`，名称、日期等用 `--name`、`--date` 等修饰；当前选中继续使用 `.is-current`。正文元信息统一为 `.document-meta__row`、`__label`、`__separator`，跳转正文链接为 `.skip-link`。

排序读取 `data-collection-cell` 和 `data-collection-header`，进入条目使用 `data-collection-entry`，排序箭头使用 `data-sort-indicator`。这些标记表达行为，样式类表达呈现；SSR 和动态路径列一起输出它们。删除了旧 `grid-*`、`cell-*`、`path-column-link` 类名，不保留两套选择器。类名和文件名无需逐字一致，`grid` 在文件或局部变量中仍准确描述 CSS Grid 实现。

`base.css` 仅负责元素默认值、焦点、跳转正文和全站过渡。共享不等于基础：图标、画幅和列表仍用自身职责命名，不因进入 `page.css` 而机械增加 `base-` 前缀。

新增名称前先确认职责；不因为位置移动而重命名 Hugo 原生字段、公开网址协议或已有准确名称，也不保留无删除条件的旧名称转接层。
