---
title: تقنيات الموقع
description: تقنيات هذا الموقع ومعلومات البناء وحالة العمل دون اتصال والتحميل المسبق.
url: powered-by/
layout: page-article-norss
weight: 96

params:
  icon: code
  slots: [breadcrumb]
  site_update:
    labels:
      check: "تحقق من التحديثات"
      checking: "جارٍ التحقق…"
      installing: "جارٍ تثبيت الإصدار الجديد…"
      check_failed: "تعذر التحقق"
      unavailable: "تحديثات Service Worker غير متاحة في هذه البيئة."
      status: "حالة التحديث"
      status_current: "لا يوجد تحديث ينتظر التفعيل"
      status_ready: "البرنامج الجديد جاهز. يفعّله المتصفح بعد إغلاق الصفحات التي تستخدم البرنامج القديم."
      status_offline: "غير متصل"
      status_click_retry: "حاول التحقق مرة أخرى"
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

## Banyan {#banyan}

قالب Hugo الذي يستخدمه هذا الموقع، مع التصفح بالأعمدة والصفحات متعددة اللغات والعمل دون اتصال.

{{< theme-version label="إصدار القالب" local="تطوير محلي" >}}

{{< new-tab href="https://github.com/SwawHQ/banyan" >}}المصدر{{< /new-tab >}} · {{< new-tab href="https://swaw.com/d/banyan/changelog/" >}}سجل التغييرات{{< /new-tab >}}

## Hugo {#hugo}

مولّد المواقع الثابتة المستخدم لبناء هذا الموقع.

الإصدار: {{< hugo-version >}}

{{< new-tab href="https://gohugo.io/" >}}الموقع{{< /new-tab >}} · {{< new-tab href="https://gohugo.io/news/" >}}الإصدارات{{< /new-tab >}}

## بناء الموقع {#build}

{{< site-build >}}

## PWA {#pwa}

الوصول دون اتصال. يدير المتصفح تحديثات برنامج Service Worker.

{{< site-update >}}

## تشخيص التحميل المسبق {#diagnostics}

{{< details-start summary="اعرض معلومات التشخيص" >}}

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
