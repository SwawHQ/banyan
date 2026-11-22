---
title: 未发布
url: p/unreleased/
description: 记录 Banyan 下一版本的改动。
date: 2026-11-20
lastmod: 2026-11-22
---

断网访问未缓存的页面时，Service Worker 会显示内置英文提示。站点升级时可删除原有离线页及 `sw.offline_notice_path` 配置，并在构建前移除 `site-status "offline"` 短代码。
