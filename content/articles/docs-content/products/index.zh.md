---
title: 07 怎么展示产品和价格？
date: 2026-11-17
lastmod: 2026-11-17
url: p/products/
description: 用文章介绍产品，在产品列表中显示价格。
---

## 设置产品栏目

1. 在目标栏目 `_index*.md` 中设置 `layout: page-collection-products`。
2. 将产品文章放在栏目下，或通过 `_map.toml` 引用已有文章。
3. 在产品文章的 `params.offer` 中填写价格。

## 添加产品信息

引用已有文章时，在产品栏目的 `_map.toml` 中填写正文路径，例如：

```toml
refs = ["/articles/product-info/banyan"]
```

产品正文只声明展示信息，不写分类字段：

```yaml
params:
  offer:
    amount: 0
    currency: "$"
    version: "1.0.0"
```

不展示价格时可省略 `offer`。展示价格时，填写金额 `amount` 和币种 `currency`。
未标价显示 `—`，价格升序和降序均排在已标价项后；0 显示本语言的“免费”。
`version` 可保留为产品定义值，列表不显示，也不按它排序。价格和版本字段不决定文章进入哪个栏目。

## 检查结果

运行 `swban server`，确认产品列表显示名称、更新时间和价格，点击名称可打开产品正文。汇总下级产品时，在独立汇总栏目使用 `page-collection-products-all`，并把 `params.aggregate` 设为产品根栏目的内容路径，例如 `/products`。
