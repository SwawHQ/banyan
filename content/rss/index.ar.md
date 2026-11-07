---
title: الاشتراك عبر RSS
description: اشترك في المقالات الجديدة باستخدام قارئ RSS.
date: 2026-09-08
url: rss/
layout: page-article-norss
weight: 90

params:
  icon: rss
  slots: [breadcrumb]
---

أضف عنوان الاشتراك إلى قارئ RSS لتلقي تحديثات المقالات.

## جميع المقالات {#all-articles}

{{< rss-link >}}

## الاشتراك حسب التصنيف {#by-section}

لصفحة قائمة **تصنيف** أو **تصنيف فرعي** توفّر RSS، احذف `?` أو `#` وكل ما يليها إن وُجد. أضف `index.xml` بعد `/` الأخيرة في مسار التصنيف للحصول على عنوان الاشتراك. مثال (بافتراض وجود مسار التصنيف `category1/category2/`):

```text
صفحة التصنيف: {{< site-root >}}category1/category2/
صفحة التصنيف: {{< site-root >}}category1/category2/#...
صفحة التصنيف: {{< site-root >}}category1/category2/?...

عنوان الاشتراك: {{< site-root >}}category1/category2/index.xml
```

> صفحات المقالات الفردية لا توفّر مصادر RSS.\
> يشمل مصدر التصنيف الرئيسي أيضًا مقالات تصنيفاته الفرعية.\
> قد يعطّل مالك الموقع الاشتراك عبر RSS لبعض التصنيفات.
