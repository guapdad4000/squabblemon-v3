---
name: Movement-lock promises
description: Keep movement, hand-return, and play-only restrictions distinct when checking counters.
---

An ability that promises its target cannot move must prevent the return-to-hand operation itself during its active window. Keeping the lock on the returned instance and rejecting a later play is not equivalent.

**Why:** A locked character could still escape its district through a hand bounce even after the lock survived the reset. The engine records that return as movement from a district to no district, so redeployment-only tests missed the original violation.

**How to apply:** For a new all-movement lock, audit hand returns and instance resets alongside manual, forced, and district movement. Assert that a blocked return leaves the target on its original board lane, never adds it to hand, and grants no return-dependent success or reward. Test that the return becomes legal after the promised expiry. Preserve separately authored exceptions rather than broadly changing older lane-specific locks.

## Play-only closures are not movement locks

Construction's late-round closure prevents playing cards there, not movement into or out of the district. Genuine story lane locks still restrict movement. Do not use a combined list of unplayable lanes as a movement-legality check.

**Why:** A new departure counter initially reused the play-lock list and incorrectly stopped ordinary movement into Construction. Its own focused counter tests passed; the existing district regression exposed the difference.

**How to apply:** Before spending a departure counter, check restrictions for the attempted action, not a broader no-play list. Cover ordinary Construction movement, a counter intercepting an otherwise legal route into Construction, and a genuine story-locked route that leaves the counter ready.