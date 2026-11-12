---
# Root navigation includes Home and published direct children.
title: Banyan
weight: 10
description: A minimal reference site for the Banyan Hugo theme.
layout: page-home

params:
  # To use the wall: change layout, enable aggregate and wall, and remove the home-art shortcode.
  # aggregate: /articles #Source section; include descendants and references, without duplicates.
  # Use with layout: page-collection-wall-all; uncomment params.wall to enable the wall.
  # wall:
  #   size:                #Target image size in CSS px; adapts to available space, excluding title and gap.
  #     width: 300        #Number or auto; two numbers set a fixed crop ratio.
  #     height: 125        #Number or auto; one auto dimension preserves the source ratio. Not both auto.
  #   details: title       #title: title opens details; overlay: image dots; overlay-hover: dots on hover, always on touch.
  #   scroll: horizontal   #horizontal or vertical.
  show_navigation: true
  # Icons also accept a name from assets/site/icons.toml or {image: "site/icon-192.png"}.
  icon: {image: "site/favicon.link.svg"}
  # Browser/tab title; title above remains the visible heading.
  browser_title: Banyan — A Minimal Hugo Publishing Theme
---

{{< home-art "/_res/home-art/wind" >}}
