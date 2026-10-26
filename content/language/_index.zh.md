---
title: 语言
url: language/ #重命名内容目录时保留此网址。
layout: page-collection-language
outputs: [HTML] #不生成此栏目的 RSS 订阅源。
weight: 70

params:
  labels: #按当前语言翻译值；保留键名。
    back: "返回"
    missing_translation: "本页尚未提供 [{lang}] 版本。\n前往该语言首页吗？" #保留 {lang}；它会替换为所选语言名称。
  icon: language
  robots: noindex, follow #原样填入 <meta name="robots" content="…">；含 noindex 或 none 时，从 sitemap.xml 和 llms.txt 排除此页。
---
