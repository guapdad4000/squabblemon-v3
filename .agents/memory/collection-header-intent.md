---
name: Card-screen header intent
description: User-directed header placement and card-browsing density in Collection and the deck editor.
---

Keep the Collection title on the left and the owned-card count on the right at desktop widths. On narrow phones, preserve that left/right reading order below the navigation rather than covering it.

**Why:** The user explicitly corrected a prior attempt that moved both pieces to the right; the separated count is meant to animate on load without shifting the title.

**How to apply:** When revisiting the Collection hero or responsive layout, maintain the independent title and count anchors and avoid a shared text block that forces them together.

Improve deck-picker density by reclaiming unused header space, not by shrinking card artwork or hiding editing controls.

**Why:** The user marked the deck title, count, and lineup to move upward into the space beside the central navigation so more collection cards remain visible.

**How to apply:** Preserve readable cards and the wide-screen left-title/right-count arrangement around the tabs. Keep narrow-screen controls usable rather than forcing that arrangement onto phones.