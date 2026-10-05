# Approved battle presentation

Final browser verification passed at 320×568, 390×844, 430×932, 844×390 and 1440×1000, with both light and dark root themes and no uncaught browser errors. Checks cover district inspection, nested card details, hold-to-inspect, focus restoration, card selection, the targeting line, hand scrolling, resizing, touch swiping and drag-to-play. These are emulated browser checks, not physical-device or hosted multiplayer results.

The hand and location panels are transparent; bright location art uses soft shadows. The redundant selected-card text row is removed. Targeting starts at the selected card, and portrait board art uses its authored aspect ratio. The card details design is preserved, with district typography scoped to avoid affecting it.

- [Phone board and targeting](390-targeting-third-card.png)
- [Small phone](320-targeting-third-card.png)
- [Approved district view](390-district.png)
- [Landscape](844-overview-dark.png)
- [Desktop](1440-overview-dark.png)
- [Browser results](browser.json)

Production build, TypeScript and six focused battle test files passed. Earlier performance measurements and their unmet budgets are recorded in [the refinement evidence](../../../docs/battle-refinement-evidence/README.md). No deployment or push is part of this change.
