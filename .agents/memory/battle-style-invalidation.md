---
name: Battle style invalidation
description: Why ancestor :has() and root custom properties are banned in battle/card CSS
---
Never use `.battle-arena:has(...)`-style ancestor selectors or write per-frame custom properties on `<html>`.
**Why:** Traces showed each descendant mutation/gyro tick restyling the whole ~1,400-element arena; removing them halved style-recalc time. Headless harness has no gyroscope, so root-var costs only show on real iPads.
**How to apply:** Drive arena state via explicit data-* attributes set in React; scope live effect vars to featured card elements. Use `BATTLE_PERF_TRACE` with invalidationTracking categories to find offenders.
