---
name: Payment verification fidelity
description: Separate database locking proof, synthetic signatures, and real Stripe delivery evidence.
---

Use native PostgreSQL with independent connections for payment rollback and row-lock proof; single-connection PGlite is not sufficient.

**Why:** A single database connection cannot establish that competing wallet transactions actually block, and an emulated database is not proof of production PostgreSQL transaction behavior.

**How to apply:** Keep payment concurrency tests isolated from production data, require distinct backend connections, and demonstrate blocking on a held profile lock.

Keep generated-signature adapter tests distinct from authentic Stripe webhook delivery.

**Why:** A connected Stripe test API and a passing locally signed payload prove neither endpoint configuration nor real delivery. Missing endpoint signing credentials are a verification blocker, not successful payment evidence.

**How to apply:** Report transport mocks, native database tests, actual provider operations, and authentic webhook delivery separately in payment verification records.

Do not infer that a missing Stripe dashboard sandbox means the owner is signed into the wrong account.

**Why:** Connected API access and dashboard ownership are separate capabilities; API access alone does not establish that the owner can manage the same sandbox in the dashboard.

**How to apply:** Compare non-secret account identifiers from the connection, consult current Replit documentation for the managed sandbox ownership flow, and distinguish claiming test access from enabling live payments. A webhook endpoint can exist before deployment.

Verify payment readiness against the intended account, mode, and hosting environment rather than treating a healthy integration as launch evidence.

**Why:** The connected sandbox and the owner's live merchant account are separate contexts. Sandbox tax status cannot establish live tax status, and GitHub release access does not establish Netlify secret-management access.

**How to apply:** Keep owner approvals separate from provider configuration checks and hosted checkout evidence. Do not ask for repeat approvals just because the accessible connection points at a different account.