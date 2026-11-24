---
title: 发布：主题版本
date: 2026-11-06
lastmod: 2026-11-14
url: p/releasing/
description: 整理版本说明，依次发布 Go Module 和项目标签，并发布 GitHub Release。
---

## 变更记录

在 Banyan 仓库的 `content/articles/changelog/unreleased/index.md`
及其中文译文记录用户可见的变化、配置要求和实际修复。
合并同类条目，不记录内部重构、测试细节或仅属于消费站点的变化。首次发布说明主要能力、使用要求和已知限制，不列开发期旧格式的迁移历史。后续版本只记录相对上一发布版的用户变化；需要操作时，说明受影响配置和处理步骤。

发布时将该 bundle 移至 Banyan 仓库的
`content/articles/changelog/vX.Y.Z/`，把 `title` 设为 `vX.Y.Z`、
`url` 设为 `p/vX.Y.Z/`，把 `date` 和 `lastmod` 设为发布日期。
新建 unreleased bundle，将 `date` 和 `lastmod` 设为新页面的首次发布日期；“未发布”指软件版本状态。集合布局会自动列出版本页面。
版本说明发布在 `https://banyan.swaw.com/p/vX.Y.Z/`，中文在
`https://banyan.swaw.com/zh/p/vX.Y.Z/`；内容目录移动不改变这些正文网址。

## 发布主题版本

先把参考站作为升级站点，按[更新步骤](/zh/p/upgrading/)核对上一发布版到待发布提交的差异，补齐站点配置、内容和本地覆盖。用 `swban dev/build` 验证本地主题，完成版本说明和功能检查，将待发布改动提交到 Banyan 发布分支。进入仓库根目录，使用不带前缀 v 的版本号。

```text
swban deploy/release/tag 0.1.0 --check  #查看分支、待更新文件和标签计划
swban deploy/release/tag 0.1.0          #发布或继续该版本
```

1. 命令更新 Skill 和 Theme 版本，用本地 Module 构建参考站，再一起推送发布分支和 `module/v0.1.0`。
2. 命令在临时工作目录关闭 workspace，固定根站点的 Module 版本，下载正式依赖，核对源码提交、下载校验和及 Hugo 的依赖图，再构建站点和搜索索引。
3. 构建通过后，命令提交依赖文件，一起推送发布分支和 `v0.1.0`。

Module 已发布时，重跑同一命令会核对主题源码并继续验证站点。站点问题修复后提交即可续发；已发布主题的修复使用新版本号。

也可以分开运行两个阶段。先运行 Module 命令，确认正式版本可用后再运行整仓命令。两个命令都接受 `--check`。

```text
swban deploy/release/tag/module 0.1.0   #发布 Module 标签
swban deploy/release/tag/project 0.1.0  #固定正式 Module、验证构建并发布整仓标签
```

用项目标签的提交部署参考站并核对版本页面。

## GitHub Release

需要 GitHub CLI 时再准备和登录：

```text
ghbw.cmd .setup                #准备 GitHub CLI
ghbw.cmd auth login --web      #登录 GitHub
```

使用已发布的项目标签创建 Release：

```text
ghbw.cmd release create v0.1.0 --verify-tag --notes https://banyan.swaw.com/p/v0.1.0/  #链接发布说明
```

需要附件时，追加 Skill ZIP 路径。`--verify-tag` 防止命令隐式新建标签。

## 版本显示

Powered by 使用 Hugo 的 `hugo.Deps` 读取实际主题 Module 版本。
本地替换显示“Local development”；Module 的提交和未提交状态用于诊断。
站点基于时间戳的构建／PWA 版本与主题发布版本独立。
