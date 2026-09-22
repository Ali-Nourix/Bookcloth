# Bookcloth Scroll

The engine behind the theme's **Smooth scrolling** setting.

A theme is a stylesheet and cannot run code, and smoothing a mouse wheel means
catching each wheel event, cancelling the browser's own scroll and driving the
position frame by frame. So the switch and the tuning live in the theme's
Style Settings — *Bookcloth → Interface → Scrolling* — and this plugin reads
them off the page. It has no settings of its own; its settings tab only shows
what it sees.

## Install

1. Copy the `bookcloth-scroll` folder into your vault's `.obsidian/plugins/`.
2. *Settings → Community plugins*: turn Restricted mode off if it is on, then
   enable **Bookcloth Scroll**.
3. *Style Settings → Bookcloth → Interface → Scrolling* to tune it.

Without the Bookcloth theme active it does nothing.

## What it smooths, and what it leaves alone

It takes over a **notched mouse wheel** only — one that moves in steps of 120
in the legacy `wheelDelta` units, which every mouse wheel does on every
platform Chromium runs on. A trackpad or a free-spinning wheel already scrolls
smoothly and carries its own momentum; smoothing that is how scroll smoothing
usually makes things worse, so it is left to the system, and for a third of a
second after one of its events nothing else is touched either.

Also left alone: Ctrl or Cmd with the wheel (zoom), Shift (sideways), Alt, any
wheel something nearer the pointer has already claimed, and surfaces that use
the wheel for something other than scrolling — canvas, graph, Excalidraw,
maps. A plugin view can opt out with `data-bc-scroll="native"`.

It turns itself off when the theme's motion level is **None** or the system
asks for reduced motion.

## How it moves

An exponential approach: every frame, the page covers the same fraction of the
distance still to go, and the fraction comes from the real time elapsed, so the
glide is the same at 30, 60 or 144 frames a second. The distance still to go is
what sets the speed — a long scroll moves fast and slows as it arrives, a short
one is gentle from the start. Notches that arrive close together count as one
spin and travel further each, so a quick flick crosses a long note while a
slow turn reads line by line.

Anything else that moves the page mid-glide — CodeMirror correcting a line
height, a jump to a heading — is carried along rather than undone. A click, a
key or a touch hands the scroll straight back.

`preview/scroll-lab.mjs` holds it to all of this, in 28 checks.
