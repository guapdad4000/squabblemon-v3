> Historical report. Superseded by [rules 42 Blood / Crips balance](blood-crip-balance.md), including CLUE’s final 4-Motion cost and +2 remote support.

# Crip / Blue Set follow-up

**Current scope: GUAP is excluded from every test deck.** Any historical GUAP-containing comparison below was outside the requested scope and must not guide further changes. Retained raw reports are historical evidence; the current runners reject GUAP.

Historical first-pass report (v37). See [the v40 rivalry buffs](crip-rivalry.md) and [latest homage follow-up](crip-homage.md) for later rules and validation.

Built on main `5f3686c`, which includes the verified v36 release `245c390`.
This pass preserves that release's training fixes, Initiation +2 recruitment,
Ganger Blue +3/+4 remote cover, and Blue-Nose Pit's delayed training.

## Changes (balance and online rules 37)

- **OG Blue / Crossfire:** retains its 3-damage shot and existing Blue Side scaling.
  Adds +1 Hand for each other district containing a friendly Blue Set card,
  capped naturally at two districts. Natural members and Initiation recruits count;
  several members in one district still provide only one extra Hand.
- **LOOK OUT / On Point:** retains its one-use call and district discount.
  The actual call also gives the weakest other friendly Blue Set card +2 Hands.
  An empty crew gets no extra buff. Disabled watchers cannot call or pay the bonus.
- **Ganger Blue / Blue Side Cover:** covering a Blue Set ally also gives Ganger Blue
  +1 Hand. The recipient still gets +4 and Protection. Ordinary allies still get
  +3 and Protection; the solo fallback remains +1.

All printed costs/Hands and the ten-card authored Crip deck remain unchanged.
CLUE COOKY, Blue-Nose Pit, Initiation, and generic Water/support cards receive no
additional ability changes. Updated card text comes from the shared catalog used
by the collection and battle UI. Both rules versions advance together so existing
issued matches cannot replay under changed combat semantics.

## Paired comparison

Run from the repository root:

```sh
pnpm --filter @workspace/scripts exec tsx src/crip-buff-check.ts before
pnpm --filter @workspace/scripts exec tsx src/crip-buff-check.ts after
```

Run `before` against unchanged v36 engine sources, then `after` against this patch.
The runner refuses to overwrite a result. It uses the same Blue Set ten-card roster
against each of the other 36 authored ranking crews, two new seed labels, greedy
and seeded-legal policies, base/full training, mirrored seats, rotation zero and
SQUABBLE enabled: 576 matches per arm. GUAP exclusions match the existing ranking
rosters. Engine fingerprints and complete per-match results are retained.

These are fixed-roster bot scores (draws count half), not live player win rates or
proof of metagame parity. Two seed labels do not guarantee independent layouts.

## Verification

- 197/197 targeted tests pass, including 17 new Crip regressions and complete
  authoritative replay comparisons at base and full training.
- Workspace typechecking passes. The balance runner also passes its final scripts
  typecheck after its output was compacted to omit per-card telemetry arrays.
- Final broad frontend suite: **1,429/1,433 passed**, with four unrelated failures: one source-art PNG is
  absent from the Git checkout, Griddle has an obsolete damage assertion, and two
  story tests expect obsolete dialogue/version values. The latter three were
  reproduced using unchanged v36 engine and frontend sources extracted from main.
- No production deployment, push, saved-deck mutation, or economy change.

## Results

All 1,152 matches completed with zero simulation failures. Exact match axes and ordered rosters agree between arms. No gameplay changes were made after the candidate run started.

| Slice | v36 | v37 | Change |
|---|---:|---:|---:|
| all | 37.85% | 41.75% | +3.91 pp |
| base | 35.42% | 40.45% | +5.03 pp |
| trained | 40.28% | 43.06% | +2.78 pp |
| greedy | 31.25% | 35.76% | +4.51 pp |
| seeded | 44.44% | 47.74% | +3.30 pp |
| player | 30.03% | 37.33% | +7.29 pp |
| cpu | 45.66% | 46.18% | +0.52 pp |

Raw match outcomes: [before](../../scripts/results/crip-followup/before.json), [after](../../scripts/results/crip-followup/after.json). Per-card telemetry arrays are omitted from these compact reports; match outcomes, axes, deck lists and engine fingerprints are retained.
