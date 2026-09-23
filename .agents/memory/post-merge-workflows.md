---
name: Post-merge workflow ownership
description: Diagnosing duplicate managed service processes after automatic task merges.
---

A workflow marked failed is not proof that its previous service process stopped.

**Why:** Automatic task-merge reconciliation left old API and web service trees alive while replacements failed with address-in-use errors. The app still answered requests, concealing that the managed replacements had failed.

**How to apply:** Confirm the listener's process tree and working directory before stopping anything. Gracefully stop only the verified stale service tree, confirm the port is released, then restart the existing managed workflow. Do not create a replacement workflow or change ports to evade the stale listener.