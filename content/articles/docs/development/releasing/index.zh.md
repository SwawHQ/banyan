---
title: 发布版本
url: p/releasing/
description: 整理版本说明，为同一源码提交创建项目和 Go Module 标签，并发布 GitHub Release。
---

## 变更记录

在 Banyan 仓库的 `content/articles/changelog/unreleased/index.md`
及其中文译文记录用户可见的变化、配置要求和实际修复。
合并同类条目，不记录内部重构、测试细节或仅属于消费站点的变化。

发布时将该 bundle 移至 Banyan 仓库的
`content/articles/changelog/vX.Y.Z/`，把 `title` 设为 `vX.Y.Z`、
`url` 设为 `p/vX.Y.Z/`，把 `date` 和 `lastmod` 设为发布日期。
新建 unreleased bundle。集合布局会自动列出版本页面。
版本说明发布在 `https://banyan.swaw.com/p/vX.Y.Z/`，中文在
`https://banyan.swaw.com/zh/p/vX.Y.Z/`；内容目录移动不改变这些正文网址。

## 配套标签

在 Banyan 仓库更新 Skill 的 `metadata.version` 和 `module/theme.toml` 的 `version`，
使用同一本次版本号，将源码、文档和版本说明提交到同一个 Banyan 提交。
两个发布标签都创建在 Banyan 仓库，指向该提交。

进入 Banyan 仓库根目录后执行；下面以 `0.1.0` 和当前 `HEAD` 为例：

```text
gitbw.cmd tag v0.1.0 HEAD                                                     #标记项目版本
gitbw.cmd tag module/v0.1.0 HEAD                                              #标记 Go Module 版本
gitbw.cmd push --atomic --no-follow-tags origin tag v0.1.0 tag module/v0.1.0  #发布两个标签
```

`gitbw.cmd` 和 `ghbw.cmd` 使用当前仓库对应的身份。`v0.1.0` 用于项目发布和提取 Skill；
`module/v0.1.0` 供 Go 将子目录 Module 识别为 `v0.1.0`。
因为 Module 根目录是 `module/`，仅有项目标签不能提供该 Module 的语义版本。
这是 [Go 的子目录 Module 标签规则](https://go.dev/ref/mod#vcs-version)。
GitHub Release 使用 `v0.1.0`，无需再为 `module/v0.1.0` 创建 Release。
若附带 Skill ZIP，包含 Skill 目录和许可证，排除 `.tools`、`node_modules` 和缓存。

## GitHub Release

需要 GitHub CLI 时再准备和登录：

```text
ghbw.cmd .setup                #准备 GitHub CLI
ghbw.cmd auth login --web      #登录 GitHub
```

用该提交构建并发布 Banyan 参考站点，核对版本页面后，在 Banyan 仓库推送上述标签并创建 Release：

```text
ghbw.cmd release create v0.1.0 --verify-tag --notes https://banyan.swaw.com/p/v0.1.0/  #链接发布说明
```

需要附件时，追加 Skill ZIP 路径。`--verify-tag` 防止命令隐式新建标签。

## 版本显示

Powered by 使用 Hugo 的 `hugo.Deps` 读取实际主题 Module 版本。
本地替换显示“Local development”；Module 的提交和未提交状态用于诊断。
站点基于时间戳的构建／PWA 版本与主题发布版本独立。
