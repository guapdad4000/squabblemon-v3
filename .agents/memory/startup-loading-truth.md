---
name: Startup loading truth
description: Product rules for Squabblemon startup progress and media enhancement.
---

The startup experience must report real readiness gates: application code, account services, player profile, and route assets. Do not use a timed or indeterminate percentage that implies measured progress.

**Why:** The asset catalog is large, and a decorative spinner hid which dependency was actually delaying entry. Loading every cinematic asset up front would make startup worse.

**How to apply:** Keep the first paint lightweight. Start optional broadcast video only after application code is ready, and skip it for reduced motion, Data Saver, and slow connections. Never preload the full character or special-move catalog.