---
root_nav: true
title: Powered by
icon: code
description: "The technology behind this site, build information and PWA status."
slug: powered-by
layout: page-powered-by
weight: 96
outputs: [HTML]
build:
  list: local
slots:
  breadcrumb: true
powered_by:
  banyan: "The Hugo theme behind this site, with column browsing, multilingual pages and offline access."
  hugo: "The static site generator used to build this site."
  source: "Source"
  changes: "Change log"
  website: "Website"
  releases: "Releases"
  revision: "Theme commit"
  dirty: "Uncommitted changes"
  version: "Build version"
  build: "Site build"
  time: "Build time"
  commit: "Site commit"
  pwa: "Offline access and updates that activate before the next same-tab site navigation once ready."
site_update:
  labels:
    check: "Check for updates"
    checking: "Checking…"
    installing: "Installing the new version…"
    check_failed: "Check failed"
    unavailable: "Service Worker updates are unavailable in this environment."
    status: "Update status"
    status_current: "No update waiting to activate"
    status_ready: "New version ready; it will activate on your next same-tab site navigation."
    status_offline: "Offline"
    status_click_retry: "try checking again"
    controlled: "Page controlled by a Service Worker"
    yes: "Yes"
    no: "No"
---

{{< powered-by >}}
