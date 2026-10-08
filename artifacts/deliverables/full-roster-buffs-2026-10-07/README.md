# Full roster buff sweep — October 7, 2026

Reviewed all 267 collectible cards: 266 screened, GUAP excluded. Final candidate changes 18 cards: 16 receive +1 printed Hand; The Rapper and The OG Rap Legend deploy one Motion earlier with one fewer printed Hand. Costs, identities, upgrades, rarities, art and abilities otherwise remain unchanged. GUAP is exactly equal to the saved baseline definition.

## Final card changes

| Card | Before Motion / Hands | After Motion / Hands |
|---|---:|---:|
| Dance Circle Captain | 3 / 3 | 3 / 4 |
| Krump | 3 / 3 | 3 / 4 |
| Foodz | 3 / 2 | 3 / 3 |
| Side Chick | 2 / 2 | 2 / 3 |
| Corner Coach | 3 / 3 | 3 / 4 |
| BBL Nice | 3 / 2 | 3 / 3 |
| Crazy Ex-Boyfriend | 3 / 3 | 3 / 4 |
| Lash Tech | 2 / 2 | 2 / 3 |
| Fein | 1 / 1 | 1 / 2 |
| BBL Demon | 4 / 4 | 4 / 5 |
| Red Pill | 3 / 3 | 3 / 4 |
| The Rapper | 3 / 4 | 2 / 3 |
| Stoner Sr. | 3 / 2 | 3 / 3 |
| Suga Mama | 3 / 3 | 3 / 4 |
| The Work Hubby | 2 / 2 | 2 / 3 |
| Apartment Maintenance Sage | 3 / 3 | 3 / 4 |
| The Janky Promoter | 3 / 3 | 3 / 4 |
| The OG Rap Legend | 5 / 6 | 4 / 5 |

Body changes improve relationship protection, conditional support, delayed disruption, cheap pressure, and older setup bodies. Music receives earlier engine/finisher access. The two proposed Fitness cost reductions were rejected after mixed results; Fitness keeps the Lash Tech and Apartment Maintenance Sage buffs. Six proposed body buffs were rejected because they exceeded the existing unconditional Hands limit. No limit was relaxed.

## Coverage and evidence

Each eligible card has 32 scenario observations: four benchmark crews, greedy and seeded-legal policies, both seats, base/full training, SQUABBLE enabled. The schedule uses one fixed district seed and draw rotation. Identical compositions share completed results; after trials reuse only unchanged compositions. **8,512 card-scenario observations per arm are not 8,512 independent games.** Every affected composition is rerun; nine Fitness rows were replaced with final-state reruns after rejecting that experiment.

Existing authored shells are preferred. Cards without a shell receive a same-element diagnostic insertion and are labeled accordingly. Deck score belongs to the shell, not the individual card; sparse deployment and raw ability events cannot establish individual strength. Folks is included; old GUAP/Folks-excluding league helpers are unchanged, with a Folks-containing crew added locally for this sweep. GUAP substitutions are audit-only.

Fresh confirmation uses a different district seed and draw rotation, 240 paired cases / 480 simulations, across six target decks and five strong archetypes. Score is win=1, draw=0.5, loss=0: diagnostic bot results, not human win rates or a solved balance ranking.

| Target deck | Before score | Final score |
|---|---:|---:|
| element-dark | 48.8% | 51.2% |
| element-fire | 13.8% | 16.2% |
| focus-wave7-tempo | 0.0% | 1.2% |
| starter-fitness-circuit | 25.0% | 25.0% |
| starter-music-industry | 25.0% | 36.2% |
| street-legends-relationships | 7.5% | 28.7% |

Music and relationships improve across both screens. Fitness improves in the main four-crew screen but has no gain against the strong-deck confirmation set; a dedicated synergy pass remains warranted. Fire and legacy Wave 7 remain weak against these opponents. This sweep does not claim universal parity.

## Validation

- 1,832 application regression checks passed, including full catalog/GUAP invariants and printed-Hands limits.
- Five bundle checks and eight balance/type-tempo checks passed.
- All 24 authoritative multiplayer and room-activity checks passed.
- Frontend TypeScript and production build/bundle budgets passed (GameApp 853.2 / 900 KiB; Home 922.8 / 1,200 KiB).
- Desktop and phone inspectors verified the updated Hands and Motion; screenshots are in `screenshots/`.
- Audit legality now excludes Blockbuster SQUABBLE while retaining character SQUABBLE. All affected Blockbuster trials were rerun successfully; final screens have no simulation failures.
- The combined audit/telemetry test run had 23 passes and one fixture failure: the saved current staff JSON is an unresolved Git LFS pointer, and git-lfs is unavailable. This historical report check remains unverified; it was not suppressed or rewritten.

Balance and online rules advance from 49 to 50 so authoritative snapshots cannot reinterpret unfinished older matches under new stats. Existing completed rewards are unchanged.

## Review files

- `card-decisions.csv`: every catalog card, including explicit GUAP exclusion.
- `before.json` and `after.json`: exhaustive per-card observations.
- `confirmation.json`: fresh paired strong-archetype trials.
- `catalog-before.json` and `guap-before.json`: definition invariants.

Audit script typechecking passed with a repository-wide root override because the existing scripts config imports engine files outside its rootDir; the configuration itself was not changed.

Local candidate on `codex/full-roster-buff-sweep`, based on published main `aafcb0a1`. Not committed or pushed.
