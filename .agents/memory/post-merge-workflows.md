---
name: Post-merge workflow ownership
description: Diagnosing duplicate managed service processes after automatic task merges.
---

A workflow marked failed is not proof that its previous service process stopped.

**Why:** Automatic task-merge reconciliation left old API and web service trees alive while replacements failed with address-in-use errors. The app still answered requests, concealing that the managed replacements had failed.

**How to apply:** Confirm the listener's process tree and working directory before stopping anything. Gracefully stop only the verified stale service tree, confirm the port is released, then restart the existing managed workflow. Do not create a replacement workflow or change ports to evade the stale listener.

Concurrent Vite processes must not share an optimized-dependency cache, even when they attempt to bind the same port.

**Why:** Vite begins dependency optimization before detecting a port collision. A failed replacement startup overwrote files used by the still-running preview, mixing React dependency generations and crashing an otherwise valid first hook on a lazy route. React deduplication alone cannot prevent this. Process-isolated caches intentionally trade some warm-start speed for runtime consistency.

**How to apply:** Keep each Vite process's default cache isolated, preserve explicit isolated fixture caches, and verify a mounted page can enter lazy routes after a competing startup fails. Do not rewrite valid hooks to conceal this environment failure.