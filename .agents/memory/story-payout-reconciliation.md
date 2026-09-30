---
name: Story payout reconciliation
description: Why historical story reward uplifts are separated from ordinary mutation reads.
---

Historical first-clear reward gaps should be settled as new, one-time make-good claims on authenticated campaign entry, while ordinary campaign reads inside completion or battle mutations remain passive.

**Why:** An internal campaign read that grants older missing rewards can silently change the wallet between a successful current-node grant and its receipt. That would make the animated starting balance misleading and could mix historic payouts into a newly completed battle. Existing battle snapshots and claim identities are promises about the original award, not migration targets.

**How to apply:** Reconcile from server-held progress and immutable claims under the profile lock, return only newly credited amounts with the confirmed wallet for a one-time catch-up acknowledgement, and leave past snapshot rewards untouched. Preserve separate perfect-clear ticket claims when computing the direct-ticket gap.