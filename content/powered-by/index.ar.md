---
title: تقنيات الموقع
description: تقنيات هذا الموقع ومعلومات البناء وحالة العمل دون اتصال والتحميل المسبق.
url: powered-by/
layout: page-powered-by
weight: 100

params:
  icon: code
  slots: [breadcrumb]
  site_status:
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
  diagnostics:
    heading: "ملحق: معلومات ذاكرة PWA المؤقتة"
    version: "محلي:"
    content: "الخادم:"
    interval: "بدء المزامنة:"
    policy: "سياسة SW:"
    status: "حالة SW:"
    interval_format: "عند الانتقال إلى صفحة وفاصل زمني ≥ %d دقائق"
    hugo: "Hugo:"
    more: "مزيد من معلومات التشخيص"
    transport_intro: "يخص هذا الفحص الصفحة الحالية. اختر وسيلة التحميل المسبق، ثم طبّق الاختيار وأعد التحميل."
    worker_note: "لا يتجاوز هذا الاختيار اعتراض Service Worker للطلبات، ولا يلغي تسجيله."
    devtools_note: "لتجاوز اعتراض الطلبات، افتح DevTools → Application → Service Workers → Bypass for network. وافحص التحميل المسبق المدمج في Application → Speculative loads."
    test_links: "روابط الفحص"
    link_hint: "مرّر المؤشر فوق رابط أو انتقل إليه بلوحة المفاتيح. على شاشة اللمس، اضغط الرابط. يجدول المتصفح التحميل المسبق حسب السياسة الحالية."
    support: "دعم المتصفح"
    env: "الوسيلة المختارة"
    actions: "الروابط المرشحة"
    runtime: "جدولة مخصصة"
    payload: "الإعدادات والقواعد المنشورة"
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

**Swaw Banyan** {{< asset src="site/swaw-banyan.svg" alt="Banyan" class="icon icon--image md-inline-image" width="16" height="16" >}}: {{< new-tab href="https://github.com/SwawHQ/banyan" >}}{{< theme-version local="تطوير محلي" >}}{{< /new-tab >}}
