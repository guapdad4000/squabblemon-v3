---
name: Netlify migration proof
description: Why a ready monorepo deployment is not sufficient evidence that native database migrations ran.
---

Verify the exact deployment's migration list and the exact database branch's applied versions before enabling database-backed features.

**Why:** A Netlify preview reached `ready` while reporting an empty migration list even though the SQL files existed in its verified GitHub tree. The monorepo package directory and build base resolved native migration artifacts differently; setting the documented source path alone did not fix discovery.

**How to apply:** Preserve native migration packaging across both directory boundaries. Confirm provider-reported applied versions and schema presence on the intended isolated branch; never infer schema readiness from build success or work around missing publication evidence with manual production SQL.