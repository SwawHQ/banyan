---
title: 怎么定义页面艺术效果？
date: 2026-11-17
lastmod: 2026-11-17
url: p/home-art/
description: 用 Hugo 短代码为页面添加自己的艺术效果。
---

在本站 `layouts/_shortcodes/` 下定义 Hugo 短代码，例如 `layouts/_shortcodes/art-banner.html`。模板可以通过 `.Get` 读取参数，通过 `.Inner` 读取正文。首页、栏目和文章都可以在正文中调用：

```text
{{</* art-banner title="欢迎来访" */>}}
```

内置示例见[风场短代码](/zh/p/appearance-customization/#修改风场)。
