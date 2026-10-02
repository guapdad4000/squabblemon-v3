Latest local candidate: [full rules 44 patch](rivalry-full-patch-v44.md), tested at base tier; the v42 evidence below is preserved.

> Follow-up: [the deeper audit](rivalry-deep-audit.md) corrects the turn-order interpretation. These earlier fixed-order bot results are not proof of online PvP parity. The current online room uses base training; see the new base-only, alternating-turn holdout.

# Blood / Crips balance candidate — rules 42

GUAP is excluded from both ten-card rosters and every matchup in this pass. The runner rejects any deck containing it. Changes remain local in `codex/crip-deck-buffs`.

## Final changes

- RED PUNCH earns its existing training upgrades once after actual Roll Call damage or a successful respect move.
- BLOCK SPINNER earns its existing training upgrades on a landed burn, including the delayed trap. Empty or blocked attempts and echoed traps cannot cash copied training.
- Cane Corso earns training on real damage, including later round-start support. Merely finding its OG, empty attacks, and blocked damage do not qualify. Existing interception rules remain unchanged.
- CLUE COOKY costs **4 Motion** and reinforces the weakest Blue Set ally in each other district for **+2 Hands and Protection**. Its capped homage, Blue donors retaining Hands, immunity, and displacement remain.
- LOOK OUT retains **three calls**, at most once per round. A two-call experiment barely affected the matchup and was rejected.
- All earlier Blue synergy changes remain, including the 2-Motion Ganger Blue, remote Crossfire bonus, and Blue-Nose Pit backup.
- Online and card-balance versions advance to 42. Printed Hands remain unchanged.
- Balance lab now honors intermediate training tiers 1 and 2 instead of treating every nonzero input as tier 3.

## Controlled measurements

Same GUAP-free rosters throughout. Draws count as half a win. Paired runs use four seeds, two rotations, both seats, both policies, and tiers 0–3: 128 matches each.

| Candidate | Crips score |
|---|---:|
| v41 baseline | 69.53% |
| Blood payout repairs | 64.06% |
| Payout repairs + two LOOK OUT calls (rejected) | 63.67% |
| Final: repairs + CLUE 4 Motion / +2 support | 51.17% |

The earlier repair-only holdout scored Crips 71.09%; it was rejected as insufficiently balanced. The final candidate was frozen before eight new seeds were evaluated. No deck substitutions were used to improve the result.

## Fresh holdout: 256 matches

| Breakdown | Crips score |
|---|---:|
| Overall | 48.63% |
| Tier 0 | 50.00% |
| Tier 1 | 53.13% |
| Tier 2 | 43.75% |
| Tier 3 | 47.66% |
| Crips in player seat | 43.75% |
| Crips in CPU seat | 53.52% |
| Greedy policy | 30.47% |
| Seeded legal policy | 66.80% |

**The policy split is a material limitation.** The aggregate meets the proposed 45–55% target, but neither policy individually does. These are correlated bot scenarios, not independent human win-rate estimates. This is a playtest candidate, not proven competitive parity. Do not average away the policy or seat differences when deciding the next change.

All runs finished without simulation failure. Final paired and holdout fingerprints match:
`e3268be35f91b89c98a0e3883bb85ab324bd3e4b8641af5a9432481599be24e2`.

## Verification

- 48 Blood regression cases cover both owners, tiers 0–3, real/empty/blocked hits, delayed payouts, echoed traps, and authoritative full-match reconstruction.
- 339 targeted shared engine, card catalog, multiplayer, and mounted Battle tests pass (327 in the combined run plus the 12 catalog tests rerun after updating cost assertions). The balance-lab suite passes 17/17, including intermediate-tier snapshot assertions.
- Four browser scenarios pass on desktop and phone: Blood's three training payouts and replay, plus CLUE's displayed cost, +2 support, and Protection.
- Workspace typecheck passes.
- Full frontend run: **1505/1509 passed**. Four pre-existing failures remain: missing portrait source asset, Griddle damage expectation, and two story/transcript expectations. The subsequently added four Blood edge-case tests pass in the focused run.
- Browser exercise is agent-driven fixture verification, not a human playtest.

## Human playtest protocol

Keep the listed decks fixed and exclude GUAP. Play at tiers 0, 1, 2, and 3, swapping both decks and first seat. Record district outcomes, winning round, remaining cards, and whether Blood could punish a spread Blue board or Crips could recover from early pressure. Review tier 2 and seat dependence first. Change one balance lever at a time only after reviewing those games; do not tune merely to cancel one bot's preferences.

## Reproduce and raw evidence

```sh
pnpm --filter @workspace/scripts exec tsx src/crip-rivalry-check.ts UNIQUE-LABEL --final
SQUABBLEMON_PROXY_ROOT='' pnpm --filter @workspace/squabblemon exec playwright test --config e2e/playwright.rivalry.config.ts
```

Browser tests use a local Vite server at port 5178 with `PORT=5178 BASE_PATH=/`.

- [blood-repair-baseline-alltiers-v41](../../scripts/results/crip-followup/blood-repair-baseline-alltiers-v41.json)
- [blood-repair-v42](../../scripts/results/crip-followup/blood-repair-v42.json)
- [blood-repair-lookout2-v42](../../scripts/results/crip-followup/blood-repair-lookout2-v42.json)
- [blood-repair-holdout-v42](../../scripts/results/crip-followup/blood-repair-holdout-v42.json)
- [blood-clue-efficiency-v42](../../scripts/results/crip-followup/blood-clue-efficiency-v42.json)
- [blood-crip-final-v42](../../scripts/results/crip-followup/blood-crip-final-v42.json)
