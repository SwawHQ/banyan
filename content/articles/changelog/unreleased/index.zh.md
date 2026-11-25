---
title: 未发布
url: p/unreleased/
description: 记录 Banyan 下一版本的改动。
date: 2026-11-22
lastmod: 2026-11-24
---

- Module 提供布局同名的页面原型、SVG 图标库、三套配色、应用清单和 robots.txt 模板。站点可用同路径文件覆盖。
- 创建文章时使用 `--kind page-article-rss`。Powered by 各译文改用 `page-powered-by` 布局，诊断区由布局渲染。升级时删除正文中的 `site-status`、`prefetch-debug-controls`、`prefetch-debug-links` 和 `prefetch-debug-state`，从整页原型补入各语言的 `params.diagnostics`。
- Powered by 页面使用独立的 Banyan 标志，更换站点 favicon 后仍显示主题标志。
- 可在 `hugo.toml` 设置 `params.manifest.enabled = false` 关闭应用清单。Apple touch 图标改名为 `apple-touch-icon.png`，默认清单使用 `pwa-192.png`、`pwa-256.png` 和 `pwa-512.png`。
- GitHub 页面头像改名为 `assets/site/avatar.github.svg`，替换此图即可更新各语言页面的头像。
- 界面字典移至站点根目录 `i18n/`，每条译文使用一行 `键 = "译文"`。
- 部署开关和 SW 内容检查间隔移至 `assets/deploy/settings.toml`，站点跳转规则移至 `assets/deploy/redirects.toml`。升级时可按 `module/archetypes/assets/deploy/settings.toml` 核对部署设置。Module 提供默认缓存与预取策略。
- 外部资源清单改用 `assets/deploy/external-resources.toml`。运行 `swban sync/resources` 下载资源，加 `--force` 可替换已有文件。
- 已移除 `centered-image`。文章内图片可写作 `![说明](photo.jpg)`，按正文默认方式对齐和缩放。
- 将引用风场艺术包的 `home-art` 改为 `art-wind`，把各语言的风场参数写入短代码正文的 JSON。文字首页直接使用 Markdown。
- 原用 `page-home` 的各语言根页改用 `page-root-navigation`，只显示根导航列。「首页」入口改用 `page-content-only`。在 `content/home/index*.md` 中给承担页面一级标题的风场设置 `page_heading: true`。
- 再次点击导航列中已选中的条目可收起右侧栏目，返回该列表并保留排序。
