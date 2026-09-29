---
name: Story portrait cache revisions
description: Keep revisions consistent for character art referenced through story paths and catalog IDs.
---

Treat direct story portrait paths and catalog card images as two views of the same revisioned asset. An art replacement needs to invalidate both paths, without adding a second revision query to cards.

**Why:** Story encounters retain stable identities and reference portrait files by path. Revising only the catalog image helper updates collection and battle cards but can leave an old cached story portrait visible.

**How to apply:** When replacing an existing character image, check the direct story path and the catalog image path in the same test. Keep the revision tied to the underlying asset, not to its caller.