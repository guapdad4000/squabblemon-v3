---
name: Story crew recovery
description: The narrow fallback that keeps campaign battles playable when a profile has no ownership-valid crew.
---

Story battles should use the player’s selected legal saved crew whenever one exists. If ownership filtering leaves no playable crew, story mode alone may fall back to an immutable starter recipe authored and recognized by the server.

**Why:** Legacy or partially migrated profiles can lose enough ownership rows that every saved and starter crew fails client filtering, stranding every campaign battle at deck building. Extending the exception to practice or arbitrary saved gangs would weaken rewarded-match authorization.

**How to apply:** Keep normal ownership validation for practice, PvP, and saved custom crews. Limit recovery to canonical starter recipe IDs, preserve story-node progression checks, and send the normal authoritative story-start request so the server still owns encounter creation and reward verification.