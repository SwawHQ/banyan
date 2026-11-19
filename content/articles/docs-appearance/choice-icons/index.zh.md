---
title: 09 语言和外观图标怎么改？
date: 2026-11-17
lastmod: 2026-11-17
url: p/choice-icons/
description: 设置语言与外观选项的图标。
---

## 修改选项图标

语言和外观页面使用 `_index.<lang>.md`，分别声明 `page-collection-language`、`page-collection-appearance` 和 `outputs: [HTML]`。这两种布局提供固定选项，不提供列表排序。

语言选项按配置 `weight` 排列；外观选项依次为“跟随系统、浅色、深色”。

在外观设置页的 `params.appearance_icons` 中指定三个选项的图标。图形定义在 `assets/site/icons.toml`；也可选择文字或图片。第一列入口继续使用页面声明的 `params.icon`。

```yaml
params:
  icon: theme
  appearance_icons:
    auto: appearance-auto
    light: appearance-light
    dark: appearance-dark
```

语言名称、顺序和启用状态仍以根项目 `hugo.toml` 的 `[languages]` 为事实源。选项图标由目标语言设置页的 front matter 提供：

```yaml
# content/language/_index.md
params:
  icon: language
  language_icon: { text: "EN" }
```

演示站为英语、简体中文和阿拉伯语配置 `EN`、`简`、`ع` 文字图标。
未设置 `language_icon` 时使用主题的语言 SVG。

语言页的选择仍留在设置页；返回原内容时优先打开刚选语言的真实译文。具体规则见 [系统页面与返回](/zh/p/navigation-state/#系统页面与返回)。

## 检查结果

运行 `swban server`，打开语言和外观设置页，检查选项图标，并分别切换语言和外观。
