---
sites:
  matrix:
    languages: ["**"]
build:
  list: never
  render: never
  publishResources: false
cascade:
  build:
    list: never
    publishResources: false
  params:
    robots: noindex, follow
    slots: [] #breadcrumb: path navigation; meta: article metadata, chapters and BlogPosting; []: disable all.
---
