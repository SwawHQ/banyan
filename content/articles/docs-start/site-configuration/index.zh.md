---
title: 02 设置自己的站点
date: 2026-11-06
lastmod: 2026-11-15
url: p/site-configuration/
description: 设置站点网址、站名和语言，检查各语言首页。
---

## 根配置

本页在完整参考站点上修改配置。安装和预览命令见[开始使用](/zh/p/getting-started/)。示例只展示相关字段：在已有表中修改对应项，不要把整段追加到文件末尾。

在 `hugo.toml` 开头修改正式网址：

```toml
baseURL = "https://example.com/"
```

把示例域名换成自己的完整网址；如果部署在子目录中，连同子目录一起填写，例如 `https://example.com/blog/`。它影响站点地图、订阅和规范地址。本地预览仍使用终端显示的本机网址。

已上线站点更换网址时，按[域名设置](/zh/p/custom-domain/)完成绑定和重新发布。

初次配置时保留其余构建设置，尤其是：

| 设置 | 保留它的原因 |
| --- | --- |
| `minify.disableJS = true` | 避免压缩改变脚本后，浏览器因 CSP 拒绝执行 |
| `module.mounts` 中的界面字典挂载 | 让界面使用站点的 `assets/i18n/` 字典 |
| `cascade` 中的 `build.publishResources = false` | 避免自动发布未使用的页面包文件，包括 `_map.toml` |
| `printPathWarnings`、`panicOnWarning` | 在页面发布网址冲突时停止构建 |

文章网址与栏目目录见[创建栏目](/zh/p/directories/)，索引开关见[站点发现](/zh/p/discovery/)，部署步骤见[构建和检查](/zh/p/deploying/)。

## 站点说明与语言

先编辑首页。参考站的 `content/_index.md` 是英文首页，`content/_index.zh.md` 是中文首页，`content/_index.ar.md` 是阿拉伯文首页。例如，在中文首页修改已有字段：

```yaml
title: 我的站点
description: 介绍本站提供的内容。
```

`title` 用作站名；`linkTitle` 可单独设置导航文字。参考首页还设有 `params.browser_title`，它会覆盖浏览器标签标题，应一并修改或删除。各篇文章的 `description` 可覆盖首页提供的默认说明。

首页的风场文字在艺术包中设置，步骤见[修改风场](/zh/p/appearance-customization/#修改风场)。也可切换到[文字首页](/zh/p/home-minimal/)。

语言在 `hugo.toml` 的 `[languages]` 中设置：

```toml
[languages]
en.label = "English"
en.locale = "en-US"
en.weight = 1
zh.label = "中文"
zh.locale = "zh-Hans"
zh.weight = 2
```

`label` 是语言名称，`weight` 控制排列顺序；根配置的 `defaultContentLanguage` 决定默认语言。它不会随排列顺序改变。`defaultContentLanguageInSubdir` 决定默认语言是否也放在语言子目录中，调整后检查原有网址。

暂时不提供某种语言时，可在文件顶部、任何 TOML 表之前设置：

```toml
disableLanguages = ["ar"]
```

此例停用阿拉伯语，保留内容文件以便以后恢复；不要停用当前默认语言。改变默认语言前，要核对无语言后缀文件的归属，并检查各语言首页和文章是否仍发布到预期地址。

新增语言时，完成三处配置：在 `[languages]` 中声明语言，补齐 `assets/i18n/<语言代码>.toml` 界面字典，再添加同名页面的译文，如 `index.fr.md`、`_index.fr.md`。界面字典只翻译按钮等界面文字，不替代正文翻译。

参考站的界面字典挂载已配置，无需重复添加。语言选项图标与设置页见[选择列表](/zh/p/choice-icons/)。

## 站点状态页

编辑已有的各语言 `content/powered-by/index*.md`，在正文中维护说明、源码和变更记录链接。该页通过短代码显示版本和诊断信息：

| 短代码 | 显示内容 |
| --- | --- |
| `theme-version`、`hugo-version` | 主题与 Hugo 版本 |
| `site-status "version"` | 当前页面的站点构建版本 |
| `site-status "interval" "每 %d 分钟检查"` | 内容检查间隔 |
| `site-status "policy"` | 缓存策略链接 |
| `site-status "status"` | SW 程序状态与检查按钮 |
| `site-status "content"` | 本页与服务器的站点构建版本比对 |

`params.site_status.labels` 提供各语言文案。检查按钮只检查，不激活等待中的 SW，也不自动刷新页面。预取诊断见[预取配置](/zh/p/prefetch-rules/#诊断)。

## 替换本站内容

发布前将 Banyan 产品说明和品牌内容替换为本站内容，并检查以下位置：

| 内容 | 编辑位置 |
| --- | --- |
| 首页文字和链接 | 当前首页引用的艺术包，见[首页定制](/zh/p/appearance-customization/) |
| 图标与应用名称 | `assets/site/`，见[应用名称与图标](/zh/p/web-app/) |
| 关于、GitHub 等页面 | `content/about/`、`content/github/` 等页面的正文 |
| 文章来源链接 | `hugo.toml` 中的 `params.content_source`；改为自己的仓库或删除该配置 |

Banyan 文档与版本说明可以保留，也可以删除。删除前，把首页艺术包中的文档链接、Powered by 中的版本说明链接改为 Banyan 官网对应地址。删除产品说明时，同时处理引用它的 `_map.toml`。

## 检查设置

重新预览站点，检查站名、浏览器标签和语言切换。打开每种启用语言的首页和一篇文章，确认文字与网址正确。

## 下一步

继续阅读[03 写第一篇文章](/zh/p/first-article/)，添加自己的内容。
