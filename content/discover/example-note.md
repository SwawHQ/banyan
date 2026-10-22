---
title: "A Predictable Content Model"
linkTitle: "Content Model"
date: "2026-01-01T00:00:00+08:00"
url: p/example-note/
description: "A small article demonstrating Banyan's content directories, metadata, and breadcrumb navigation."
---

This page is intentionally small. It demonstrates article rendering, metadata,
and breadcrumb navigation in a clean consumer site.

## Structure Before Decoration

Banyan derives navigation from real pages and directories. A page declares what
it is, while the theme owns how that structure is presented.

The file's directory defines its main location. Other directories can include
the same article through `_map.toml`, without copying its content.
