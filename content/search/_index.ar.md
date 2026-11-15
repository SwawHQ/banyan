---
title: بحث
layout: page-search
weight: 25
outputs: [HTML]
params:
  icon: search
  robots: noindex, follow
  slots: []
  # Run swban build to update the search index; Hugo alone does not update it.
  index:
    # rss: language homepage RSS entries, including its item limit.
    # "**/*.html": recursive HTML match; "*.html": root files only.
    # Arrays form a union, e.g. ["p/", "docs/**/*.html"]. End directories with /.
    # Paths use the language output root, not content/. Directories match HTML recursively.
    # At the site root, ** also includes other language subdirectories.
    source: rss
    # Content scope: existing classes, IDs or attributes. Keep equal across languages.
    selector: ".article .prose"
  labels:
    prompt: "اكتب للبحث في محتوى هذه اللغة."
    loading: "جارٍ البحث…"
    count: "{count} نتيجة"
    empty: "لا توجد نتائج."
    error: "البحث غير متاح. أعد المحاولة أو حدّث الصفحة."
    more: "المزيد من النتائج"
    no_script: "فعّل JavaScript لاستخدام البحث."
---
