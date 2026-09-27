---
name: Netlify migration proof
description: Why a ready monorepo deployment is not sufficient evidence that native database migrations ran.
---

Verify the exact deployment's migration list and the exact database branch's applied versions before enabling database-backed features.

**Why:** A Netlify preview reached `ready` while reporting an empty migration list even though the SQL files existed in its verified GitHub tree. The monorepo package directory and build base resolved native migration artifacts differently; setting the documented source path alone did not fix discovery.

**How to apply:** Preserve native migration packaging across both directory boundaries. Confirm provider-reported applied versions and schema presence on the intended isolated branch; never infer schema readiness from build success or work around missing publication evidence with manual production SQL.

Structural coverage is more reliable than comparing migration filenames when an initial native migration consolidates development history. Table-and-column presence alone is insufficient: unique indexes and constraints can be absent while routes still appear to work.

**Why:** A coverage check that recognized only tables and added columns passed even when uniqueness protection was removed from the native history.

**How to apply:** Compare behavior-changing DDL (including indexes, constraints, and column definitions), fail closed on unfamiliar development statements, and keep this check read-only; it does not establish that the provider actually applied the files.

For local API repairs, identify the actual connection selected by the server before applying a migration; do not substitute the workspace's managed-database query target. When authorization covers only an additive repository migration, execute that exact SQL on the confirmed target rather than a whole-schema push.

**Why:** A Git sync can update API code without migrating the separate database behind its connection string. Whole-schema synchronization may change unrelated objects, while a database callback may point somewhere else entirely.

**How to apply:** Confirm a safe target fingerprint and database identity with read-only queries, obtain approval for that target, then apply only the repository migration and verify profile counts, old balances, and new column properties without exposing connection credentials or account IDs.

Post-deploy event failures do not retroactively change a Netlify deploy's `ready` status. A successful build and a successful post-migration verification are separate release signals.

**Why:** The runtime branch can still be missing schema after publication; an event-function failure appears in function logs or an operator alert, not as a failed deploy build.

**How to apply:** Keep database probes in the post-deploy event using the API's own database selection, redact connection failures, and require operators to examine the event result before treating a ready deploy as schema-ready.