---
name: Balance evidence
description: Keep engine balance comparisons separate from deck-composition experiments and player win-rate claims.
---

Treat the element audit as evidence about hand-picked crews under two limited bot policies, not optimized element strength or live player win rates. Preserve the same decks, seats, district seeds, rotations, upgrade tiers, and policy when comparing mechanics; evaluate replacement decks separately.

**Why:** The audit crews were assembled for broad element coverage, not supplied or endorsed as optimal decks. A small single-seed subset gave substantially different rankings from the full schedule, and replacing cards changes curve and synergy as well as the individual ability being investigated.

**How to apply:** Keep versioned baselines, state the per-crew sample size and policy, disclose that draws count as half a point, and report failed simulations explicitly. Do not use a stronger replacement deck to claim the engine patch improved the original crew, or infer a card's causal strength from an unmatched replacement.

For paired one-card deck replacements, hold the seeded draw-order key fixed across the original and candidate decks.

**Why:** A deck's ID can also seed its card order. Changing both the card and that order makes a same-schedule bot comparison less informative; different filler swaps can reverse the apparent result even when the new card's rules are unchanged.

**How to apply:** Use a shared order key as well as identical seeds, rotations, tiers, seats, and bot policy. Compare the same opponent schedule, and describe outcomes as deck-composition samples rather than isolated card strength.

Treat a fixed bot matchup target as a hypothesis, not a number to tune by repeatedly increasing card power. The policy reacts to changed board values and can choose worse placements; score may fall after an apparent buff, and one seed schedule can pass while a fresh mirrored schedule fails.

**Why:** In Wonderland-versus-Oz return experiments, larger next-play Hands and several stronger-looking synergies worsened results. One setup met the target on a holdout but missed badly on the original schedule, with large player/CPU seat differences.

**How to apply:** Report each seat separately, preserve the opponent and policy, and require a fresh schedule before calling a balance target met. Once a schedule is used to select a card or deck change, treat it as tuning data and reserve another untouched schedule for the final choice. Rerun the comparison after engine corrections that affect upgraded-tier behavior. Prefer retaining a correct printed-rule fix over shipping unrelated buffs selected solely to clear one sample.

Inspect finalized runtime cards and their actual trigger eligibility before diagnosing an ability; an original expansion row is not necessarily the playable kit.

**Why:** Balance investigations repeatedly attributed strength to hand bonds already removed by creative reworks, and to older abilities that the loaded catalog no longer used.

**How to apply:** Query the assembled card data for the exact audit crew, then inspect the corresponding live engine branch. Verify that a proposed target is actually in the fixed comparison crew before predicting its effect on that crew's results.

Validate reported mechanic activation against actual events, not loose text matching. Character names and upgrade messages can contain mechanic words without representing that mechanic.

**Why:** Squabblehouse names were mistaken for SQUABBLE activations in descriptive balance telemetry. Upgrade successes inflated ability ratios, while zero-delta wrapper events hid changes already recorded by nested effects. Match outcomes remained valid, but those counters did not support balance conclusions.

**How to apply:** Spot-check telemetry against raw transcripts before diagnosing a card. Separate base abilities from upgrades and inspect nested effects before declaring a wrapper unsuccessful. Prefer structured activation evidence; mark unavailable counters unknown rather than substituting zero.

Separating emitted base, upgrade, and nested events does not establish an ability's eligible-opportunity denominator. Keep reliability unknown until attempts and eligibility are independently recorded.

**Why:** A staff echo can be logged under the echoed staff rather than the initiating card, and passive opportunities may produce no source-attributed event. A cleaner event ratio still cannot measure all opportunities.

**How to apply:** Use event counts as descriptive evidence only; do not restore failure-rate flags from them. Keep archived raw reports unchanged when telemetry meaning evolves.

Paired crew comparisons must share the engine deck ID, draw-order key, and logical A/B role. Swapping player/CPU seats is a separate axis. Distinguish crews with report roles and output directories instead.

**Why:** The draw-order key controls shuffling, but the engine deck ID also salts card instance IDs. Some deterministic effects seed from those instance IDs, so changing only a report label can introduce another gameplay difference. A/B role also salts deck shuffling; putting the focus deck first changes its hands even when both player/CPU seats are tested.

**How to apply:** Keep the deck ID, order key, A/B assignment, opponent, policy seed, and schedule fixed for both compositions. When filtering a league into a focused holdout, preserve the original pair orientation rather than always promoting the subject to A. Bind explicit crew roles and complete roster definitions into result fingerprints so a shared ID cannot allow cross-crew reuse.

An audit bot must enumerate actions that are legal for each card kind before evaluating them. Require complete, paired case sets with no simulation failures before accepting matchup rates. A separately predeclared, complete primary block can remain valid when a confirmation block fails, but the full audit and each incomplete confirmation must be explicitly blocked.

**Why:** Speculatively evaluating SQUABBLE on a support card threw the correct gameplay rejection. Matrix and raw executions failed identically, so outcome parity alone still accepted severely incomplete samples. Later, an untouched confirmation schedule exposed a shared gameplay crash during legal-candidate preview; omitting that candidate's game would bias the reported rate even though the primary round robin had completed.

**How to apply:** Keep support cards in the authored crew, allow their normal plays, and exclude only their illegal SQUABBLE actions. Check zero failures, exact Cartesian case counts, unique keys, and matching keys across crews before writing accepted results. Never treat rejected simulations as losses, drop an entire faulting district to manufacture a clean holdout, or skip a legal option that exposes an engine defect. Save failed case keys and reproduce the shared engine path; after a fix, rerun complete source-consistent blocks.

When isolating an ability revision, keep corrected shared engine rules identical in every arm. Establish original ability behavior from the frozen engine, not from printed descriptions or assumptions about its intent.

**Why:** Historical Janitor already reversed Queen execution through its outcome-based missing-target check, although its text emphasized Hands and statuses. Removing that behavior would manufacture a weaker control. Restoring a whole historical engine would also reintroduce unrelated movement defects.

**How to apply:** Replay fresh-charge reference cases before constructing selective original-kit overlays. Preserve shared legality corrections, restore complete original descriptions, and reject executable changes outside exact approved regions; keyword-based whole-hunk checks are insufficient.

Keep historically pinned audit runners frozen when live balance rules advance; do not relax their version guards just to make the current test suite pass.

**Why:** Archived experiments are evidence about their original rules, not current gameplay. Relabeling their versions or regenerating their plans with a newer engine breaks that provenance.

**How to apply:** Read immutable archived fixtures for engine-independent schedule and merge tests, and explicitly test rejection of incompatible current rules. Run new comparisons into separate directories. An output-only harness change may reuse a verified control only when exact crews, identities, and ordered cases still match and the harness change is disclosed.

Exclude GUAP from new deck-balance comparisons.

**Why:** The user described GUAP as "the strongest card in the game" and said "we shouldn't test with him," requesting his removal from the test decks rather than an investigation or nerf.

**How to apply:** Keep new ranking builds GUAP-free and legal at ten cards, disclose any replacement, and preserve historical results unchanged. This is a test-roster rule, not permission to change GUAP or players' decks.

Close overall performance can be balanced even when crews have different strengths across seeds and upgrade tiers.

**Why:** The user explicitly approved the close Air/Water comparison as “THATS WHAT I CALL BALNCE” despite their differing seed and tier advantages.

**How to apply:** Preserve distinct crew identities and report the breakdowns alongside the overall result. Do not flatten every matchup or keep increasing card power just to make every subgroup equal.