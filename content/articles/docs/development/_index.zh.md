---
title: 开发资料
description: 从源码入口理解模块职责，选择检查并发布主题。
---

先按[本地开发](/zh/p/local-development/)运行参考站点，再按任务读取下列资料。

| 任务 | 阅读入口 |
| --- | --- |
| 判断改动属于哪个模块 | [布局与 partial 架构](/zh/p/partial-architecture/) |
| 修改页面列、公共列表或样式 | [UI 命名与职责](/zh/p/ui-naming/) |
| 修改内容归属和面包屑模型 | [面包屑导航模型](/zh/p/breadcrumb-models/) |
| 修改来源、排序、章节或返回行为 | [导航状态协议](/zh/p/navigation-state/) |
| 修改 SW 缓存或更新 | [Service Worker 回归检查](/zh/p/service-worker-regression-checklist/) |
| 选择浏览器检查 | [浏览器检查](/zh/p/browser-regression/) |
| 准备版本说明与标签 | [发布版本](/zh/p/releasing/) |

这些资料说明跨模块约定和源码入口。函数、内部字段和局部算法以源码为准；解释设计原因的注释放在所属模块附近。通用检查方法由 Skill 维护，源码测试见 [tests/README.md](https://github.com/SwawHQ/banyan/blob/main/tests/README.md)。
