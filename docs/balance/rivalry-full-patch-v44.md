# Blood / Crips full patch — rules 44

This combines the earlier Crips synergy work, Blood trigger repairs, both dogs' approach movement, and the final Blood buffs. Base cards are the balance baseline. XP curves, unlocks, and progression are unchanged; tiers 1–3 are regression coverage. GUAP is excluded from both fixed rivalry rosters.

## Player-facing changes

### Crips
- CLUE COOKY stays at 4 Motion / 6 Hands. Losing-lane homage caps at +4 per reveal; Blue Set donors contribute without losing Hands. The weakest Blue Set ally in each other district gets +2 Hands and Protection.
- Ganger Blue costs 2 Motion. It gives a remote ally +3 Hands and Protection, or +4 for Blue Set and +1 to itself. Without a remote ally it gains +1 itself.
- LOOK OUT calls up to three times per match, at most once per round. Each call grants the next-play lane discount and +2 Hands to the weakest other Blue Set ally; another Blue Set ally enables round-start rearming.
- OG Blue gains up to +2 additional Crossfire Hands for Blue Set presence in the other districts.
- Blue-Nose Pit supports its OG for +1 and the weakest remote Blue Set ally for +2 once per round.

### Blood
- Cane Corso increases from 2 to **3 base Hands**, still costing 2 Motion.
- Ganger Red gains its +1 Hand when its attack lands damage **or consumes a Protection charge**. A consumed shield still blocks damage. No target or an immune target without consumed Protection earns nothing. Consuming one shield counts even if another shield remains.
- RED PUNCH, BLOCK SPINNER, and Cane Corso correctly award their existing one-time training bonuses on successful effects, including qualifying delayed effects; empty or blocked attempts do not earn them.

### Both crews
- Both dogs walk one adjacent lane toward their matching OG when played, then support if they arrive. Existing round-start walking and defensive interception remain. Echoes do not add approach steps; movement restrictions still apply.
- Initiation applies its recruit bonus and consumes the target's training upgrades once.
- Shared online rules and card-balance versions advance to 44.

## Base-card evidence

Scores count draws as half a win. These are bot results, not human win rates.

| Paired online-command test, 192 games/version | Crips score |
| --- | ---: |
| v42 before dog approach | 46.875% |
| v43 dog approach only | 47.396% |
| v44 full patch | 43.229% |

The full patch shifts this paired sample toward Blood. Policy scores remain widely split (greedy 25%, paired seeded 68.75%, two-play chain 35.938%), so the overall score alone does not establish parity. Both deck assignments and opening seats are included, with the actual alternating online turn flow.

## Fresh base-only holdout

192 additional games using new seeds: **Crips 46.354%, Blood 53.646%**. The two-play chain policy split was 50/50; greedy scored Crips 29.688% and paired-seeded 59.375%. Crips scored 43.75% when opening and 48.958% otherwise. Both runs completed without simulation failure.

Keep the full patch as a human-playtest candidate. The fresh aggregate is close, but policy sensitivity remains; do not describe it as proven competitive parity. Human base-card matches are the next useful evidence before more stat changes.

## Validation and release status

- 383 focused engine, catalog, roster, multiplayer, and rivalry tests passed.
- Expanded Blood regression suite passed 89/89, including eight additional stacked-Protection cases after the full-suite run.
- Eight balance-patch tests passed separately.
- All eight desktop/phone browser checks passed, including base Ganger Red shield consumption, Corso's displayed 3 Hands and approach, and complete shared-screen games with replay verification.
- Frontend and dedicated browser-fixture TypeScript checks passed.
- Production build and bundle budgets passed (entry 210.3 KiB / 475; GameApp 887.1 / 900; Home 964.7 / 1200).
- Full frontend run: 1624/1628 passed. The same four previously identified failures remain: missing portrait source asset, Griddle damage expectation, and two story/transcript expectations. No claim of a completely green suite.
- Approved for publication to main with the validation results and known unrelated failures recorded above.

## Reproduce

```sh
pnpm --filter @workspace/scripts exec tsx src/rivalry-online-audit.ts NEW_LABEL --base-holdout
pnpm --filter @workspace/scripts exec tsx src/rivalry-online-audit.ts NEW_FRESH_LABEL --base-holdout --seed-prefix=rivalry-full-fresh
```

Raw reports: `scripts/results/crip-followup/full-rivalry-paired-v44.json` and `full-rivalry-fresh-v44.json`. Reproduction labels must be new; the runner refuses to overwrite results.


Both report gameplay fingerprints: `2daf1b61251f50cd0735c82a8f309dd0970ba8e0055173ed709865196c3f8131`.
