---
title: Wind home

params:
  styles: [style.css]
  scripts: [script.js]
  brand_line: Clear structure for exploratory publishing.
  # home_signal_drift_seconds: 90       #Base cycle time in seconds.
  # home_signal_launch_gap_seconds: 4   #Spacing between signal starts, in seconds.
  # home_wind_field_start_offset_rem: 6 #Top offset of the signal area, in rem.
  # home_signal_guide_chance: 0         #0-100 share of signals with a trailing guide line.
  # Signals follow this order; omit url for selectable text without a link.
  home_signals:
    - name: Articles - All
      url: /articles-all/
      primary: true #Double this signal's cycle time.
    - name: Articles - Categories
      url: /articles/
    - name: Products - All
      url: /products-all/
    - name: Products - Categories
      url: /products/
    - name: Documentation
      url: https://swaw.com/d/banyan/docs/
    - name: GitHub
      url: https://github.com/SwawHQ/banyan
---

{{< home-art/wind/scene >}}
