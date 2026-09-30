---
name: Story reward import boundary
description: Why story reward presentation receives character lookups from its route instead of importing story content.
---

Keep story-character catalog lookups in the lazy story route; the shared reward presenter should receive only the character details it needs.

**Why:** An eager import of the full story catalog through shared reward presentation added roughly 318 KiB to the game shell and exceeded its enforced release bundle budget, even though the reward UI itself needed only names and portraits.

**How to apply:** When adding reward types or artwork, keep story-only data behind its route boundary and pass a small lookup or result into shared presentation code. Preserve the receipt's visible name and portrait, and check the production bundle budget.