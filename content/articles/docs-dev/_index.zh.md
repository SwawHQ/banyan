---
title: 文档 · 开发资料
description: 运行参考站点，理解源码入口，再按改动查阅约定、检查与发布。
weight: 6
params:
  default_sort: name-asc
---

先读[01 本地开发](/zh/p/local-development/)，运行参考站点；再读[02 项目结构与源码入口](/zh/p/partial-architecture/)，定位要修改的模块。

其余资料按任务查阅：

| 分组 | 阅读入口 |
| --- | --- |
| 约定 | [UI 命名](/zh/p/ui-naming/)、[面包屑模型](/zh/p/breadcrumb-models/)、[导航状态](/zh/p/navigation-state/) |
| 检查 | [浏览器检查](/zh/p/browser-regression/)、[Service Worker 回归](/zh/p/service-worker-regression-checklist/) |
| 发布 | [主题版本](/zh/p/releasing/) |

这些资料说明跨模块约定和源码入口。函数、内部字段和局部算法以源码为准；设计原因在所属模块附近说明。通用检查方法由 Skill 维护，源码测试见 [tests/README.md](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。站点安装和配置见[使用指南](/zh/articles/docs-guide/)。
