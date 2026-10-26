---
title: 語言
url: language/ #重新命名內容目錄時，保留此網址。
layout: page-collection-language
outputs: [HTML] #不產生此欄目的 RSS 訂閱來源。
weight: 70

params:
  labels: #依此語言翻譯文字，保留鍵名。
    back: "返回"
    missing_translation: "本頁尚未提供 [{lang}] 版本。\n前往該語言首頁嗎？" #保留 {lang}，顯示時會替換為所選語言的名稱。
  icon: language
  robots: noindex, follow #原樣填入 <meta name="robots" content="…">；含 noindex 或 none 時，從 sitemap.xml 和 llms.txt 排除此頁。
---
