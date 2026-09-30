---
name: Story deck editor return
description: Why story-launched deck editing carries an explicit validated return destination.
---

When entering the deck editor from story crew selection, carry a return destination for that specific story battle setup through both direct saves and save-and-leave. Do not rely only on browser Back.

**Why:** Saving a starter recipe creates a different saved deck and replaces the editor URL. The old history entry may no longer identify the intended story setup, while dirty-exit confirmation must continue to guard deliberate returns.

**How to apply:** Validate return destinations as internal story battle routes before using them; retain the destination across recipe-to-saved redirects, and let ordinary editor exits continue through the existing unsaved-change guard.