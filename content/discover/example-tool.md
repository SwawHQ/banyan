---
title: Banyan CLI
date: "2026-10-21T00:00:00+08:00"
url: p/example-tool/
description: Check a Banyan site and its generated page metadata.
offer:
  amount: 0
  currency: "$"
  value: Check site setup and generated page metadata.
---

Banyan CLI is included in the `swaw-banyan` skill. Run these commands from the
site directory. Build the site before checking `public`.

```text
swban doctor .                    #Check the site and tools
swban check/html/metadata public   #Check generated page metadata
```

The `free` and `first-party` directories reference this article through
`_map.toml`. Product lists show a free price and the value declared in `offer`.
