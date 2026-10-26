---
title: Language
url: language/ #Keep this route when renaming the content directory.
layout: page-collection-language
outputs: [HTML] #Disable this section's RSS feed.
weight: 70

params:
  labels: #Translate values for this language; keep the keys.
    back: "Back"
    missing_translation: "This page does not yet have a [{lang}] version.\nGo to the [{lang}] homepage?" #Keep {lang}; it is replaced with the selected language name.
  icon: language
  robots: noindex, follow #Use as <meta name="robots" content="…">; noindex or none excludes this page from sitemap.xml and llms.txt.
---
