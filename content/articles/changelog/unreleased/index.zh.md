---
title: 未发布
url: p/unreleased/
description: 记录 Banyan 下一版本的改动。
date: 2026-11-22
lastmod: 2026-11-23
---

- Module 提供文章原型、SVG 图标库、三套配色、应用清单和 robots.txt 模板。站点可用同路径文件覆盖。
- Powered by 页面使用独立的 Banyan 标志，更换站点 favicon 后仍显示主题标志。
- 可在 `hugo.toml` 设置 `params.manifest.enabled = false` 关闭应用清单。Apple touch 图标改名为 `apple-touch-icon.png`，默认清单使用 `pwa-192.png`、`pwa-256.png` 和 `pwa-512.png`。
- GitHub 页面头像改名为 `assets/site/avatar.github.svg`，替换此图即可更新各语言页面的头像。
- 界面字典移至站点根目录 `i18n/`，每条译文使用一行 `键 = "译文"`。
- 部署开关移至 `assets/deploy/settings.toml`，站点跳转规则移至 `assets/deploy/redirects.toml`。Module 提供默认缓存与预取策略。
- 外部资源清单改用 `assets/site/external-resources.toml`。运行 `swban sync/resources` 下载资源，加 `--force` 可替换已有文件。
