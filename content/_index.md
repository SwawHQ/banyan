---
# Root navigation includes Home and published direct children.
title: Banyan
weight: 110
description: A minimal reference site for the Banyan Hugo theme.
layout: page-home

params:
  # Icons also accept a name from assets/site/icons.toml or {image: "site/icon-192.png"}.
  icon: { text: "B" }
  # Browser/tab title; title above remains the visible heading.
  browser_title: Banyan — A Minimal Hugo Publishing Theme
  # Short line beside the site title.
  brand_line: Clear structure for exploratory publishing.
  # Optional scene settings (defaults shown).
  # home_signal_drift_seconds: 90       #Base cycle time in seconds.
  # home_signal_launch_gap_seconds: 4   #Spacing between signal starts, in seconds.
  # home_wind_field_start_offset_rem: 6 #Top offset of the signal area, in rem.
  # home_signal_guide_chance: 0         #0-100 share of signals with a trailing guide line.
  # Entries follow this order; omit url for selectable text without a link.
  home_signals:
    - name: Notes - All
      url: /notes-all/
      primary: true #Doubles this signal's cycle time; does not change navigation priority.
    - name: Notes - Categories
      url: /notes/
    - name: Products - All
      url: /products-all/
    - name: Products - Categories
      url: /products/
    - name: Documentation
      url: https://swaw.com/d/banyan/docs/
    - name: GitHub
      url: https://github.com/SwawHQ/banyan
---
