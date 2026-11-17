---
title: 首页：怎么制作自己的首页？
date: 2026-11-17
lastmod: 2026-11-17
url: p/home-art/
description: 复制首页艺术包，修改模板、样式和脚本。
---

## 复制艺术包

1. 将 `content/_res/home-art/minimal/` 复制为同级的 `custom/`。
2. 修改 `custom/index*.md` 中的 `params.heading`、`params.description` 和正文。
3. 编辑包内 `scene.html.tmpl` 和 `style.css`，设置页面结构和样式。
4. 将各语言首页 `content/_index*.md` 的布局设为 `page-home`，正文引用改为：

```text
{{</* home-art "/_res/home-art/custom" */>}}
```

需要脚本时，在包内添加 `script.js`，并在各语言艺术页的 `params` 中设置 `scripts: [script.js]`。

## 模板中的文字

模板通过 `.Params` 读取艺术页参数，通过 `.Content` 输出 Markdown 正文。文字和 HTML 属性值使用 `htmlEscape`，已渲染的 `.Content` 可直接输出。

```html
<h1>{{ .Params.heading | htmlEscape }}</h1>
<div>{{ .Content }}</div>
```

## 检查结果

运行 `swban dev`，检查各语言首页、浅色和深色外观，以及手机宽度。部署前按[发布站点](/zh/p/deploying/)完成构建和 CSP 检查。

## 覆盖主题文件

站点中的同路径布局和资源覆盖 Module 文件。升级前保留本站定制，并对照目标版本检查覆盖文件。主题版本和本地替换见[准备 Git 源码](/zh/p/deploying/#准备-git-源码)，源码开发见[本地开发](/zh/p/local-development/)。
