---
title: 06 怎么设置旧网址跳转？
date: 2026-11-17
lastmod: 2026-11-17
url: p/url-redirects/
description: 声明旧路径和新地址，发布并检查网址跳转。
---

移动文章文件时，保留页面的 `url` 即可保持发布网址。需要改变发布网址时，再添加跳转规则。

## 添加跳转规则

1. 打开 `assets/site/delivery.toml`。
2. 在文件末尾添加一条 `[[redirects]]`，填写旧发布路径和新地址。
3. 确认目标平台的交付开关已启用。

例如，将中文旧文章永久转到新文章：

```toml
[[redirects]]
source = "/zh/p/old-article/"
destination = "/zh/p/new-article/"
status = 301
```

路径包含实际语言前缀和部署子路径，使用浏览器访问的地址。其他语言分别添加对应规则。永久迁移使用 `301`；临时跳转使用 `302`。

## 构建并发布

按[构建和检查](/zh/p/deploying/#构建与检查)生成新产物。Cloudflare Pages 将规则写入 `_redirects`，EdgeOne Makers 写入 `edgeone.json`。

上传方式发布完整产物目录。EdgeOne Git 构建还需[复制交付配置到站点根目录](/zh/p/edgeone-makers/#git-托管构建)，再提交并触发部署。规则始终在 `delivery.toml` 中维护。

## 检查结果

在浏览器开发工具的 Network 面板中打开旧网址，确认跳转响应的状态码为 `301` 或 `302`，`Location` 指向新地址，最终页面正常打开。

检查各语言旧路径和一个未配置跳转的正常页面，确认规则只影响预期地址。跳转由托管平台执行，应以部署后的结果为准。
