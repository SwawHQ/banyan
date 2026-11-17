---
title: 07 怎么更新 Banyan？
date: 2026-11-17
lastmod: 2026-11-17
url: p/upgrading/
description: 选择目标版本，保留站点定制并更新主题和 Skill。
---

## 更新步骤

升级前保留本站文件与主题定制，在[版本说明](/zh/articles/changelog/)中选择目标版本。Skill 与主题使用配套版本；完整源码包的本地 `replace` 会优先于远程 Module 版本。

```powershell
swban upgrade/version/current  #查看当前版本与比对起点
swban help upgrade/git         #查看比较官方版本与保留本站定制的步骤
```

按[版本维护说明](https://github.com/SwawHQ/banyan/blob/main/.agents/skills/swaw-banyan/references/upgrade.md#change-the-version)更新 Skill、主题和受影响的站点文件。

## 检查结果

检查自己的首页、栏目和文章，再按[发布站点](/zh/p/deploying/)完成构建与检查。
