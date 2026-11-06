---
title: تقنيات الموقع
description: تقنيات هذا الموقع ومعلومات البناء وحالة العمل دون اتصال والتحميل المسبق.
url: powered-by/
layout: page-article-norss
weight: 100

params:
  icon: code
  slots: [breadcrumb]
  site_update:
    labels:
      checking: "جارٍ التحقق…"
      installing: "جارٍ تثبيت الإصدار الجديد…"
      check_failed: "تعذر التحقق"
      unavailable: "تحديثات Service Worker غير متاحة في هذه البيئة."
      status_current: "لا يوجد تحديث ينتظر التفعيل"
      status_ready: "البرنامج الجديد جاهز. يفعّله المتصفح بعد إغلاق الصفحات التي تستخدم البرنامج القديم."
      status_offline: "غير متصل"
      status_click_retry: "حاول التحقق مرة أخرى"
      content_current: "إصدار الصفحة يطابق الإصدار المنشور"
      content_failed: "تعذر التحقق من الإصدار؛ حاول مرة أخرى"
      mode_off: "إدارة Service Worker غير مفعّلة لهذا الموقع."
      mode_disable: "يطلب هذا الموقع إلغاء تسجيل Service Worker ومسح ذاكرته المؤقتة."
      status_controlled: "ما زال Service Worker مثبّت يتحكم في هذه الصفحة."
      cache_disabled: "التخزين المؤقت معطّل"
      content_checking: "جارٍ مقارنة الإصدار…"
      content_current_icon: "✅"
      refresh_icon: "↻"
      content_refresh: "تحديث إصدار الخادم"
      status_refresh: "التحقق من تحديث برنامج SW"
  prefetch_debug:
    labels:
      backend: "وسيلة التحميل المسبق"
      auto: "تلقائي"
      native: "مدمج في المتصفح"
      sw: "SW"
      link: "رابط"
      off: "متوقف"
      apply: "طبّق وأعد التحميل"
      loading: "جارٍ التحميل…"
      unavailable: "غير متاح"
      collection: "قائمة"
      article: "مقال"
---

**{{< new-tab href="https://github.com/SwawHQ/banyan" >}}Swaw Banyan{{< /new-tab >}}**: {{< new-tab href="/articles/changelog/" >}}{{< theme-version local="تطوير محلي" >}}{{< /new-tab >}}

### ملحق: معلومات ذاكرة PWA المؤقتة

**محلي**: {{< site-update "version" >}}  
**الخادم**: {{< site-update "content" >}}  
**بدء المزامنة**: {{< site-update "interval" "عند الانتقال إلى صفحة وفاصل زمني ≥ %d دقائق" >}}  
**سياسة SW**: {{< site-update "policy" >}}  
**صفحة العمل دون اتصال**: {{< site-update "offline" >}}  
**حالة SW**: {{< site-update "status" >}}

{{< details-start summary="**مزيد من معلومات التشخيص**" >}}

Hugo: {{< new-tab href="https://gohugo.io/news/" >}}{{< hugo-version >}}{{< /new-tab >}}

يخص هذا الفحص الصفحة الحالية. اختر وسيلة التحميل المسبق، ثم طبّق الاختيار وأعد التحميل.

{{< prefetch-debug-controls >}}

لا يتجاوز هذا الاختيار اعتراض Service Worker للطلبات، ولا يلغي تسجيله.

لتجاوز اعتراض الطلبات، افتح DevTools → Application → Service Workers → Bypass for network. وافحص التحميل المسبق المدمج في Application → Speculative loads.

### روابط الفحص

مرّر المؤشر فوق رابط أو انتقل إليه بلوحة المفاتيح. على شاشة اللمس، اضغط الرابط. يجدول المتصفح التحميل المسبق حسب السياسة الحالية.

{{< prefetch-debug-links >}}

### دعم المتصفح

{{< prefetch-debug-state "support" >}}

### الوسيلة المختارة

{{< prefetch-debug-state "env" >}}

### الروابط المرشحة

{{< prefetch-debug-state "actions" >}}

### جدولة مخصصة

{{< prefetch-debug-state "runtime" >}}

### الإعدادات والقواعد المنشورة

{{< prefetch-debug-state "payload" >}}

{{< details-end >}}
