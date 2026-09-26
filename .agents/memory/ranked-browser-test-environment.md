---
name: Ranked browser test environment
description: Local browser and database constraints when running the ranked journey
---

The ranked browser journey assumes Edge, which is not installed in every Replit container. An available Chromium binary can be selected with the browser executable override; browser-specific layout assertions may differ.

**Why:** A local run could not launch Edge, while Chromium launched but failed an existing horizontal-overflow assertion before reaching matchmaking.

**How to apply:** When validating ranked journeys locally, use an owned temporary test database rather than an unrelated inherited remote database. Distinguish browser provisioning and pre-existing layout failures from failures in the matchmaking journey.