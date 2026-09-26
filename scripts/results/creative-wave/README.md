# Creative card wave: deterministic balance samples

Baseline: `c6b024a57518b2fe5ebcb5bfa7f0d4617f625fc6`. Candidate: the creative rework implementation accompanying this report. All four JSON reports are reproducible with `pnpm --filter @workspace/scripts exec tsx src/creative-wave-audit.ts`, adding `--baseline`, `--seeded`, or both.

Each report contains 192 games: eight subject decks against three fixed opponents (Fire, Air, coherent counterplay), two draw rotations, tiers 0 and 3, both seats, SQUABBLE enabled, one fixed district seed. There are 768 matched baseline/candidate games across both policies. Score counts draws as half a win; each table cell is only 24 games.

| Deck | Greedy before | Greedy after | Seeded before | Seeded after |
| --- | ---: | ---: | ---: | ---: |
| Earth Rides | 68.8% | 58.3% | 56.2% | 45.8% |
| Electric Jobs | 56.2% | 47.9% | 66.7% | 66.7% |
| Club | 27.1% | 20.8% | 33.3% | 41.7% |
| Protect and Retaliate | 27.1% | 12.5% | 45.8% | 39.6% |
| Comeback | 41.7% | 25.0% | 39.6% | 35.4% |
| Plant Care | 54.2% | 31.2% | 54.2% | 39.6% |
| Air Routes | 89.6% | 50.0% | 68.8% | 66.7% |
| Public Contracts | 18.8% | 2.1% | 8.3% | 16.7% |

These results do **not** establish live win rates or universal buffs. Greedy lookahead favors immediate value and does not plan multi-turn contracts; the seeded legal policy is not a skilled player. Both opponent and subject cards use the corresponding engine version. Decklists are held fixed rather than optimized for the new abilities; Public Contracts intentionally combines many setup cards and is weak in both versions. One district seed and 24 games per cell cannot establish competitive balance.

The initial pass made several decks weaker. Follow-up tuning made Foreman and Dr. Umah recruit contributors as cards arrive, let Coach recognize an earlier failed entrance, allowed Good Company to pair across districts, and settled delayed rewards in the final round. The final results still show losses for several formerly bond-heavy lists. This release supplies distinct, bounded interactions; it does not claim that every old list becomes stronger. Earth, Plant, protection, and comeback lists need further player testing before any additional broad power increase.

## Verification

- 176 focused creative-rework cases pass, covering both owners, all 51 cards, determinism, immutability, bounded reactions, capacity, suppression, expiry, refunds, atomic paired movement, delayed entrances/statuses, original-placement forecasts, and training.
- Online authority tests cover all 51 cards at four training tiers for both owners (408 cases), including local/online equivalence, serialization, and public markers.
- Full app suite after rebasing onto main: 902 of 903 tests pass. The remaining pre-existing story-content test expects version 7 while the authored content is version 9; this wave does not change that story data.
- Library, app, and scripts type checks pass. Production build and entry-bundle budget pass. API card-progression/reward checks: 9 pass.

See [implemented card rules](../../../docs/CREATIVE_CARD_REWORKS.md) and [the original audit](../../../docs/CARD_REWORK_AUDIT.md).
