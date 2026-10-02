# Dog approach candidate — rules 43

Both Blue-Nose Pit and Cane Corso now walk one adjacent lane toward their matching Triple OG when played. They support only after reaching the OG's district. Round-start walking, support limits, interception, costs, printed Hands, and XP progression remain unchanged. Echoes cannot add another approach step.

Base cards are the balance baseline. Higher training tiers are regression checks, not a prerequisite for the decks to function. No GUAP is included.

## Paired base-card comparison

192 actual-online-command games per version, identical seeds, both deck assignments and opening seats, three decision policies; all cards at base training.

| Crips score (draw = half) | v42 | v43 |
| --- | ---: | ---: |
| Overall | 46.875% | 47.396% |
| Greedy | 31.25% | 32.813% |
| Paired seeded | 68.75% | 68.75% |
| Two-play chain | 40.625% | 40.625% |

Six game outcomes changed. Candidate runs included 192 Blue-Nose Pit plays and 156 Cane Corso plays. This supports keeping the symmetric tempo change for playtesting; it does not establish a human win rate or prove wider roster balance. These reused seeds are a paired regression comparison, not a fresh holdout.

Raw evidence: `scripts/results/crip-followup/dog-approach-paired-v43.json`, compared with `rivalry-online-base-holdout-v42.json`. Candidate gameplay hash: `d9f5e73c6d03e0ecf1f7ea1eecd91692b782b4b45a813603d2270bc0c056a7bd`.

## Verification

- 343 focused engine, multiplayer, roster and rules tests passed.
- Expanded dog suite: 42/42 passed, including both owners, all training tiers, one-step travel, support on arrival, capacity, story locks, disabled abilities, replay movement snapshots, and no extra movement from echoes.
- Frontend TypeScript passed.
- Desktop/phone browser checks: 5/6 passed initially; phone Blood replay check lost its board element during a navigation and passed on isolated rerun (1/1). Both full shared-screen games and exported replay checks passed initially. The transient failure is recorded rather than treated as a clean first-run pass.

Cane Corso's proposed base Hands increase and Ganger Red's proposed self-buff are held pending base-card human playtesting. Changes remain local and uncommitted.
