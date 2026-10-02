---
name: Reward redemption proof
description: Establishing that a newly added promo grant really redeems, rather than relying on existing green tests.
---

Verify each newly added promo through the production-mode redemption route and its returned bootstrap, including every card kind in the grant. A registry lookup or previously passing promo suite is not sufficient.

**Why:** A release passed existing redemption tests while their manually maintained fixture omitted the new code. Its mixed character/support grant was rejected before reaching the wallet transaction, despite valid catalog entries and a healthy deployment.

**How to apply:** Check that the exact new code is covered, then exercise its complete grant with native PostgreSQL fixtures on a local authenticated test server. Verify ownership after bootstrap, unchanged balances for card-only grants, one-time receipts, retries, and concurrency. Keep this separate from claims of successful redemption on a real production account.