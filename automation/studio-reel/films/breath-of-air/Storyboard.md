---
design: breath-of-air
title: A Breath of Air
duration: 26
fps: 30
aspect: "16:9"
---

<!--
  The only file a writer touches. No HTML anywhere in this document — that is the
  point of R0: if the film cannot be written here, the format is wrong.
  Every scene below is one beat on the 6/7/7/6 grid.
-->

## Scene 1 — The air we share · 0:00–0:06

frame: title-stats
tone: normal
kicker: GLOBAL AIR QUALITY
title: The air we share
copy: Air pollution is the world's largest environmental health risk.
stats:
  - { value: "7M", label: "premature deaths a year" }
  - { value: "99%", label: "of people breathe air over WHO limits" }
ambient:
  - { layer: orb-a, tone: signal, blur: 60 }
  - { layer: orb-b, tone: amber, blur: 60 }
source: WHO · State of Global Air

## Scene 2 — An invisible crisis · 0:06–0:13

frame: cards-3
tone: alarm
kicker: INDIA
title: An invisible crisis
copy: Air pollution is among India's biggest health threats — and it is measurable.
cards:
  - { big: "400+", small: "Delhi NCR AQI on a severe winter day", meter: 92 }
  - { big: "1.67M", small: "deaths a year linked to air pollution", meter: 74 }
  - { big: "21 / 30", small: "of the world's most polluted cities are in India", meter: 64 }
source: Lancet Planetary Health · IQAir World Air Quality Report

## Scene 3 — What actually works · 0:13–0:20

frame: split-icons
tone: positive
kicker: THE WAY FORWARD
title: What actually works
tiles:
  - { icon: "☀️", head: Clean power, body: "Scale solar and wind — India's 500 GW non-fossil target." }
  - { icon: "🚌", head: Clean mobility, body: "Electric buses, metro rail, and tighter fuel standards." }
  - { icon: "🌾", head: End stubble burning, body: "Crop-residue management and alternatives for farmers." }
  - { icon: "🍳", head: Clean cooking, body: "LPG and electric cooking instead of solid fuels indoors." }
source: Proven, affordable, and already scaling.

## Scene 4 — Clean air is possible · 0:20–0:26

frame: statement
tone: normal
kicker: A BREATH OF AIR
title: Clean air is possible
copy: It is not a mystery and it is not out of reach. It is a set of decisions.
asks:
  - Cut emissions
  - Invest in clean energy
  - Protect the vulnerable
ambient:
  - { layer: sun, tone: sun }
source: Built with HTML-in-Canvas · Studio Pro
