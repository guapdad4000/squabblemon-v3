> Historical report. Superseded by [rules 42 Blood / Crips balance](blood-crip-balance.md), including CLUE’s final 4-Motion cost and +2 remote support.

# Crip rivalry buffs — rules 40

**Current scope: GUAP is excluded from every test deck.** Any historical GUAP-containing comparison below was outside the requested scope and must not guide further changes. Retained raw reports are historical evidence; the current runners reject GUAP.

Historical v40 report. The [v41 homage follow-up](crip-homage.md) contains the latest rule and validation.

Continues the first pass on `codex/crip-deck-buffs`, based on main `5f3686c` and
release `245c390`. The original ten-card Crip roster is unchanged. No Blood card,
GUAP ability, elemental hand provider, saved player deck, or economy rule changed.

## Final additional buffs

| Card | Previous pass | Final |
|---|---|---|
| CLUE COOKY | 4 Motion / 6 Hands; homage and displacement | **3 Motion / 6 Hands**. Also gives the weakest friendly Blue Set character in **each other district +3 Hands and Protection**. Maximum two recipients. Successful reinforcement earns its existing once-only training. |
| Ganger Blue | 3 Motion / 3 Hands | **2 Motion / 3 Hands**. Keeps +3 remote cover, +4 for Blue Set, Protection, and the first pass's +1 self reward for covering Blue Set. |
| Blue-Nose Pit | Supports its colocated Blue Triple OG for +1 per round | Also gives the **weakest friendly Blue Set ally outside that district +2 Hands**, once per round. Still requires reaching the OG, an active dog, and a real recipient. |
| LOOK OUT | One call, one discount, +2 to a Blue ally | Refreshes at round start when backed by another Blue Set ally. **One call per round, three calls per match maximum**. Each call keeps the existing district discount and +2 to one other Blue ally; training still pays only once. |

The first pass's OG Blue cross-district bonus remains. Tagged Initiation recruits
qualify alongside natural Blue Set members. Opposing cards and ordinary allies do
not qualify. Printed Hands are unchanged; only CLUE and Ganger Blue cost less.

Both online and reward rules advance to 40. Card copy, battle cost previews and
engine behavior agree. The remaining broad-suite failures are recorded below.

## Rivalry evidence

The earlier ranking deliberately replaced GUAP with Redneck Evil. This pass tests
**both** that historical Blood list and the original list with GUAP; the two must
not be conflated. No opponent has been weakened to improve these scores.

Each opponent has 64 games per version per block: four district seed labels, two
draw rotations, two policies, base/full upgrades and mirrored seats, with SQUABBLE
enabled. The original ordered ten-card Crip roster is identical in both versions.

| Blood opponent | Calibration v37 → v40 | Fresh confirmation v37 → v40 |
|---|---:|---:|
| Historical GUAP-free ranking list | 53.13% → 60.94% | **65.63% → 78.13%** |
| Original list with GUAP | 19.53% → 32.03% | **20.31% → 37.50%** |

Scores count draws as half. This supports a substantial buff, **not parity against
GUAP Blood at every training level**. Fresh-confirmation base-tier Crips scores
26.56% against GUAP Blood; full training scores 48.44%. Its greedy and seeded-legal
scores are 28.13% and 46.88%. Historical Blood's fresh results favor Crips heavily;
these selected bot samples are not player win rates or independent statistical
samples. Wider human testing remains necessary.

The candidate was frozen before opening the four new confirmation seed outcomes.
The reconstructed v37 engine fingerprint exactly matches the retained first-pass
report. Complete ordered rosters and all 128 case keys were checked between the
confirmation arms; neither includes incomplete or failed matches.

Intermediate v38/v39 reports are retained as experiments, not final verification.
A Water-provider substitution for Alchy failed to improve the GUAP matchup; swapping
Cognac instead helped a calibration sample, but changes composition and was not
adopted or mixed into the fixed-roster results above.

## Reproduction and reports

```sh
pnpm --filter @workspace/scripts exec tsx src/crip-rivalry-check.ts LABEL
pnpm --filter @workspace/scripts exec tsx src/crip-rivalry-check.ts LABEL --holdout
pnpm --filter @workspace/scripts exec tsx src/crip-buff-check.ts LABEL
```

Use separate frozen v37/v40 engine trees for comparisons. Labels cannot overwrite
existing evidence. The runner verifies source stability and exact game counts.

- [Fresh v37 confirmation](../../scripts/results/crip-followup/rivalry-holdout-v37.json)
- [Fresh v40 confirmation](../../scripts/results/crip-followup/rivalry-holdout-v40.json)
- [v37 calibration](../../scripts/results/crip-followup/rivalry-v37.json)
- [v40 calibration](../../scripts/results/crip-followup/rivalry-v40.json)

## Verification

- **305/305 targeted checks pass**, including 33 dedicated Crip regressions,
  rendered battle previews, locked-district and tax rules, both players, base/full
  upgrades, capped recurring calls, and full authoritative match replays.
- Workspace TypeScript checks pass.
- No push or deployment. Changes remain in the isolated `codex/crip-deck-buffs`
  worktree; unrelated unfinished work in the original checkout is untouched.

- Final broad frontend suite: **1,445/1,449 pass**. The four unchanged failures are the absent source-art PNG, obsolete Griddle damage expectation, and two obsolete story expectations. No new failure remains.

## Wider-field check

The same 576 games against all 36 other GUAP-free authored ranking crews improve from **41.75% to 54.25%**, with zero simulation failures. Ordered decks and case keys match; the final engine fingerprint matches the rivalry confirmation. This is the Crip row, not a newly run complete 37-deck league.

| Slice | First-pass v37 | Final v40 |
|---|---:|---:|
| all | 41.75% | 54.25% |
| base | 40.45% | 53.12% |
| trained | 43.06% | 55.38% |
| greedy | 35.76% | 47.74% |
| seeded | 47.74% | 60.76% |
| player | 37.33% | 50.17% |
| cpu | 46.18% | 58.33% |

[Full match outcomes](../../scripts/results/crip-followup/v40.json).
