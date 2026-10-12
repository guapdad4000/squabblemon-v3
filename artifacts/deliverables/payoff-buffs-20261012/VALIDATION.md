# Validation — local v59 payoff buffs

- 1,152 new simulated matches completed with zero errors. Each comparison pairs the same deck, opponent, tier, seat and policy. Prior corrected v58 baselines are reused for sets A/B; holdout C reruns both versions with fresh draws and opponents.
- 130 focused regression tests passed.
- TypeScript check passed with scripts/payoff-buffs.tsconfig.json.
- Full root regression suite: 2,060 passed, zero failed, zero skipped across 91 files.
- First full run: 2,057 passed, three stale Ashlee assertions failed. Updated description and two-district reward expectations, and explicitly budgeted the new conditional 13-Hand swing in the favorable-board fixture. No engine changes were made after the measured simulations.
- git diff --check passed.
- Candidate canonical source matches the saved simulation snapshot.

Music improves in all three sets. Plant improves in all three sets but remains weak against Red and Cellblock Pressure. Mushroom Garden does not show a consistent improvement. Scores count draws as half a win; these small bot tests are not live player win rates or a full-league ranking.

Changes remain local in /tmp/squabblemon-minigame-polish-release; not committed or pushed. No card art, card borders, or minigame changes are part of this payoff patch.
