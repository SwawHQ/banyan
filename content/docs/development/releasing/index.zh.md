---
title: 发布版本
slug: releasing
description: 整理变更记录，并发布同版本的 Skill 和 Hugo Module 标签。
---

## 变更记录

在 `content/changelog/unreleased/index.md` 记录用户可见的变化、配置要求和实际修复。
合并同类条目，不记录内部重构、测试细节或仅属于消费站点的变化。

发布时将该 bundle 移至 `content/changelog/vX.Y.Z/index.md`，
把 `title` 和 `slug` 设为 `vX.Y.Z`，把 `date` 和 `lastmod` 设为发布日期。
新建 unreleased bundle。集合布局会自动列出版本页面。

## 配套标签

将 `SKILL.md` 的 `metadata.version` 更新为本次版本并提交。
在同一提交上创建两个标签；下面以 `0.1.0` 和当前 `HEAD` 为例：

```text
swban git tag v0.1.0 HEAD                                                        #标记 Skill
swban git tag module/v0.1.0 HEAD                                                 #标记 Hugo Module
swban git push --atomic --no-follow-tags origin tag v0.1.0 tag module/v0.1.0      #发布两个标签
```

此处 `swban` 代表已准备的 Skill 入口。
`module/v0.1.0` 使 Go 能单独解析 `module/` 子目录。
在 `v0.1.0` 上创建一个 GitHub Release。
若附带 Skill ZIP，包含 Skill 目录和许可证，排除 `.tools`、`node_modules` 和缓存。

## GitHub Release

需要 GitHub CLI 时再准备和登录：

```text
swban gh.ensure            #准备 GitHub CLI
swban gh auth login --web  #登录 GitHub
```

版本页面上线、标签推送完成后，为 GitHub Release 添加说明链接：

```text
swban gh release create v0.1.0 --verify-tag --notes https://banyan.swaw.com/changelog/v0.1.0/  #链接发布说明
```

需要附件时，追加 Skill ZIP 路径。`--verify-tag` 防止命令隐式新建标签。

## 版本显示

Powered by 使用 Hugo 的 `hugo.Deps` 读取实际主题 Module 版本。
本地替换显示“Local development”；Module 的提交和未提交状态用于诊断。
站点基于时间戳的构建／PWA 版本与主题发布版本独立。
