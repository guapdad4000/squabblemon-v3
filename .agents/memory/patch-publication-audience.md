---
name: Patch publication audience
description: Why patch publication freezes recipients and distinguishes finished delivery from incomplete delivery
---

An approved patch freezes its recipients at publication. Later signups are not silently added, and deleted accounts remain counted as undeliverable. Publication and successful delivery are separate states: a patch is public immediately, but “complete” must mean every frozen target was delivered; permanently blocked targets are partial, not successful.

**Why:** Re-running an operator-wide mail command later would expand the audience, while deleting recipient rows would erase evidence of incomplete delivery. Neither is a truthful retry of the approved broadcast. Bounded automatic retries also prevent one broken inbox from causing an endless scheduled write loop.

**How to apply:** Keep the campaign content/reward and audience ledger immutable after publication; make recovery idempotent against existing mail and claims. Show ongoing versus terminal partial delivery honestly on Events, and reserve manual retries for unresolved targets rather than replaying every player.