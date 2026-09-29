---
name: Campaign solver budget
description: Why the campaign test's search order and aggregate timeout are separate constraints.
---

An authored story encounter may require a wider greedy beam or a bank-preserving beam even when narrower alternatives are valid. Exhausting one search strategy before trying the other can consume the shared per-node budget without finding a win. A roster change can also change which search path works; a legal, owned test crew is essential evidence, not a gameplay difficulty adjustment.

**Why:** Focused deterministic encounters exposed different winning search widths and tempo plans. The complete HTTP campaign then exceeded its aggregate test timeout despite every individual battle retaining its stricter solver ceiling.

**How to apply:** When revising campaign verification, measure both the per-battle solve ceiling and the end-to-end route deadline. Keep exact server-replayable transcripts and a valid owned deck; do not treat a longer overall HTTP test deadline as permission to relax the per-battle budget.

Compare a solver timeout with the pre-change engine before attributing it to a balance patch or changing gameplay to satisfy the solver.

**Why:** A full campaign test and an isolated retry both timed out, but a focused old/new comparison reproduced the same search failure with unchanged participating cards. Running the check alone did not resolve it.

**How to apply:** Hold the encounter, legal crew, district seed, upgrade snapshot, and search limits constant. Check whether the changed cards or rules actually occur. Disclose any simplified fixture, especially default upgrades replacing database-derived progression; a bounded search failure is not proof that the battle is unwinnable.