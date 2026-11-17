---
title: 05 修改后怎么重新发布？
date: 2026-11-17
lastmod: 2026-11-17
url: p/publish-updates/
description: 按现有部署方式更新站点，并核对线上内容。
---

## 本地构建后上传

1. 修改内容并运行 `swban dev` 预览。
2. 按[构建和检查](/zh/p/deploying/#构建与检查)生成本次独立产物目录。
3. 使用原项目上传产物：[Cloudflare Pages](/zh/p/cloudflare-pages/#上传产物)或 [EdgeOne Makers](/zh/p/edgeone-makers/#上传产物)。

## Git 托管构建

1. 本地预览并完成构建检查。
2. EdgeOne 项目同步根目录 `edgeone.json`，详见[交付规则](/zh/p/edgeone-makers/#git-托管构建)。
3. 提交改动并推送到项目关联的分支。
4. 在平台部署记录中核对提交版本、环境和构建结果。

## 检查结果

按[线上检查](/zh/p/deploying/#发布后检查)确认本次内容和搜索已更新。更换网址时，参见[域名设置](/zh/p/custom-domain/)和[旧路径跳转](/zh/p/url-redirects/)。

确认发布成功且无需保留回退产物后，可删除本次临时构建目录。下次打开终端时，重新定义命令简称和 `$build`。
