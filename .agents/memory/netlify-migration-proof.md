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

Netlify, not new native migration SQL, must own the outer transaction. Already-applied historical SQL must remain byte-identical even when it contains an old transaction mistake.

**Why:** Explicit SQL commits caused `unexpected transaction status idle` after the schema and database-level history were already applied. The migration-list API still showed only the previous published bundle. Editing the seemingly pending files then failed checksum validation. A documented provider dry run against the original deploy revealed the actual current database version.

**How to apply:** Use provider dry-run validation as well as schema metadata; do not infer unapplied history from the listing API alone. Preserve applied bytes, add a forward-only corrective migration, and test it under an externally owned transaction with rollback and retry. Historical exceptions must be checksum-pinned, never broadly exempted. Do not reset or directly edit protected history.

An applied-schema recovery fixture is not a fresh hosted-bootstrap test.

**Why:** A managed runner skips already-applied historical files, including immutable transaction mistakes, while a new empty database would execute them.

**How to apply:** State that boundary in verification evidence. Validate empty-database bootstrap separately rather than weakening new-migration checks or claiming a seeded upgrade proves a fresh install.

Use the deployment's reported database branch when reading Netlify migration metadata, not its Git branch.

**Why:** The production database is labeled independently of Git `main`; querying migration history with the Git branch returned 404 even though the database existed.

**How to apply:** Obtain the database branch from the exact deployment, and inspect only that branch's provider history and read-only schema metadata without exposing connection strings.