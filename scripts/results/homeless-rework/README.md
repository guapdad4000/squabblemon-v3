# Ronald and Homeless Wiseman reworks

Ronald remains 3 Motion / 4 Hands. **WE OUTSIDE.** replaces passive remote Hands grants: once per round, enemy damage to another ally in his district calls the weakest movable friendly character from another district. Protect it before moving it, respecting capacity, movement restrictions, disabled abilities, and normal movement hooks. Lion departure and Tin Man arrival now form a reactive rescue combo. Blocked damage does not trigger it.

Homeless Wiseman remains 4 Motion / 4 Hands. **Told You.** publicly predicts the enemy's weakest open district through next round. Their next character play consumes the prediction. Playing there attempts Weaken, respecting Protection and immunity; playing elsewhere earns the predictor a one-use, district-specific 2-Motion character discount, minimum 1, through the following round. Supports do not consume predictions or discounts. Only one prediction per side; replacement does not accumulate discounts in the same district. The old 2 Hands damage is removed. Discount priority chooses the stronger reward without stacking other discounts. Public district marks expose prediction, reward, and expiry to both players.

Online rules and card balance versions advance to 8. No other card kits or stats changed.

## Reproducible audit

Run `pnpm --filter @workspace/scripts exec tsx src/homeless-rework-audit.ts` with optional `--baseline` and `--seeded`. Baseline is d3387827ac9a0b8d5f1f6a052d9720807543d523. Four reports contain 288 total matches: three subject decks, three opponents, tiers 0 and 3, rotations 0 and 5, both seats. Scores count a draw as half a win.

| Subject | Greedy before | Greedy after | Seeded legal before | Seeded legal after |
| --- | ---: | ---: | ---: | ---: |
| Nothing to Lose | 37.50% | 29.17% | 50.00% | 50.00% |
| We Outside | 52.08% | 50.00% | 62.50% | 64.58% |
| Earth Rides control | 97.92% | 97.92% | 70.83% | 70.83% |

These small fixed-seed policy samples support a creative rework, not a demonstrated global strength increase. Greedy play scores lower for the Homeless list; seeded legal play is unchanged, while the movement rescue list slightly improves under that policy. Human anticipation and avoidance of public predictions are not represented well by either bot. Earth control staying identical checks isolation. Further live balance evidence is needed before calling these numerical buffs.

## Validation

Focused regressions cover both owners, deterministic and immutable results, movement hooks and blockers, once-per-round rescue, source disabling, prediction replacement and expiry, source departure, support exclusion, shields and immunity, discount ownership/locality/priority/minimum/consumption, monotonic replay, and authoritative online commands/public projection. Typechecks and production build pass. The broad application suite has two existing stale expectations: story version 7 versus 9, and Earth roster count 19 versus 23.
