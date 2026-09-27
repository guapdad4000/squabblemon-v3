---
name: Mobile grid scroll containment
description: Why horizontally scrollable fixed-track grids need an explicit constrained width inside flex layouts
---

In a flex-column mobile stage, a grid with fixed-width tracks and `overflow-x:auto` can still take the min-content width of all tracks, then center itself beyond both viewport edges. An ordinary document overflow assertion may pass while the visible grid and adjacent controls are shifted off-screen.

**Why:** An editor lineup appeared horizontally clipped after selecting an off-screen slot, even though the document's reported scroll width matched the phone viewport. The grid's measured width was the total width of its tracks rather than its intended scrollport.

**How to apply:** For future horizontally scrollable fixed-track grids inside flex layouts, explicitly constrain the grid's width and max-width to its available container, then verify its bounding rectangle and nearby controls after programmatic and touch-style scrolling.