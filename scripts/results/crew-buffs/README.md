# Crew balance pass — September 25, 2026

This pass lowers the Oz crew's setup burden, strengthens the Homeless core, and lets Promoter support the nightlife crew across elements. Shared engine changes apply to solo and authoritative multiplayer. Saved lineups, ownership, rarity, and upgrades retain their identities.

| Card | Change |
| --- | --- |
| Dorothy | 3 Motion / 4 Hands → 2 Motion / 3 Hands. Return and redeployment discount stay the same. |
| Tin Man | First other arrival each round gains +1 Hand as well as Protection. Playing and moving qualify; disabled Tin Man does not trigger. |
| Oz | 4 → 5 base Hands. Card text now exposes the existing +2 reward when the echoed ally moved this round. |
| Homeless Guy | 3 → 4 base Hands. Investing any extra Motion adds one bonus Hand: 0→0, 1→2, 2→3, 3→4, 4→5. Last-Motion steal remains capped at 2. The battle selector shows these amounts. |
| Homeless YN | Outnumbered reveal gives +3 instead of +2 Hands. |
| Homeless Legend | 4 → 5 base Hands. Recovery still restores only actual damage, up to 2 per round. |
| Promoter | Moving Bottle Girl, Pirate Radio DJ, or Dance Captain can earn Guest List's +2. These guests and Air allies share one trigger per owner per round. |
| Hot Tub Hottie | 2 → 3 base Hands, keeping the existing cleanse payoff. |

Plant benefits from Homeless Legend; Earth gains Homeless YN's stronger comeback option. Electric already performed strongly in the selected matchups, so its general tempo was not increased. This is a targeted first pass, not a claim that every elemental deck is solved.

## Reproducible comparison

Baseline commit: `1efd7fba2d7738b409e3cb94e0f44c2ec6ed8f47`. The audit extracts that commit's engine rather than relying on a mutable checkout. Both reports use identical lineups, district seed, rotations 0/5, upgrade tiers 0/3, both seats, and SQUABBLE enabled. Each subject plays 24 matches against Fire, Air, and coherent control using the greedy policy: 168 baseline and 168 candidate matches.

| Subject | Baseline score | Candidate score |
| --- | ---: | ---: |
| Oz | 41.67% | 52.08% |
| Homeless | 18.75% | 37.50% |
| Club | 81.25% | 77.08% |
| Water | 50.00% | 56.25% |
| Electric | 89.58% | 89.58% |
| Plant | 60.42% | 75.00% |
| Earth tax | 43.75% | 43.75% |

Score counts a draw as half a win. These are small deterministic bot samples, not estimated live-player win rates. Greedy choices can change after a buff, so additional synergy does not guarantee a higher bot score. Homeless remains weaker in this sample; Club, Electric, and Plant need human playtesting before further broad buffs. The Earth tax shell does not include Homeless YN, so its unchanged result does not measure that card's buff. Exact lineups and per-match results are in `before.json` and `after.json`.

Run from the repository root:

```sh
pnpm --filter @workspace/scripts exec tsx src/crew-buff-audit.ts --baseline
pnpm --filter @workspace/scripts exec tsx src/crew-buff-audit.ts
```

## Verification

- 161 focused tests pass: fairytale, character, street, elemental leaders/redesign, and engine. Coverage includes both owners, once-per-round caps, disabled leaders, blocked movement, exact investment spending, damage-only recovery, online commands, and deterministic transcripts.
- Full application test list under Node 24: 696 pass, two existing stale assertions fail. `matchTranscript.test.ts` expects story version 7 but baseline already has 9; `superCommonCards.test.ts` expects 19 Earth characters but baseline already has 23. Both baseline values were independently read from the pinned pre-change engine. Node 22's existing synchronous CSS loader fails in component tests; Node 24 avoids that loader failure.
- Library and application TypeScript checks pass.
- Production build and entry-bundle budget pass with `PORT=4211 BASE_PATH=/ PUBLIC_ORIGIN=https://squabble.today`.
- The retired first elemental-wave test file is not in the application's test list and refers to cards absent from the active registry; this patch does not restore that retired roster.
