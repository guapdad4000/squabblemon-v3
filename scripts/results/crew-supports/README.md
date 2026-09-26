# Cellblock and support balance — September 25, 2026

The workshop now recommends Cellblock Pressure and Mushroom Garden. These are suggestions; existing saved decks are not rewritten. The historical lab lineups remain intact so composition improvements are not misreported as card buffs.

## Shipping changes

- Inmate Crafty's +2 reveal now accepts another friendly inmate here as well as a support card. Enemy, remote, token, and hazard inmates do not qualify; Crafty cannot count himself.
- Inmate Boyfriend gives the weakest eligible inmate in another district +2 instead of +1. His local +2 remains unchanged.
- Regular guy named LeBron James gains +3 instead of +1 when his district is losing after he arrives. The condition is still captured before his cleanse; his cleanse and Protection remain unchanged.
- Rastamon gives the weakest other local ally +1 when there is no frozen or silenced ally to cleanse. His original cleanse still grants +2. Playing alone or while disabled gives no fallback reward.
- Stylist gives the protected ally +2 instead of +1.
- Workshop descriptions explain the revised Cellblock setup and Plant-bond Mushroom lineup using current character names.
- Online and reward balance versions advance to 6. Old online rooms require a new room, and reward snapshot validation rejects stale balance versions.

## Deck recommendations

**Cellblock Pressure:** Inmate Crafty, Inmate Boyfriend, Inmate Informant, Inmate Contraband, Regular guy named LeBron James, Bustdown, Cognac, Tin Man, Counter, All Jokes Roaster.

**Mushroom Garden (engine IDs):** `demario`, `luigion`, `gardener`, `sprout`, `rootnurse`, `canopykeeper`, `gardenwall`, `hair-stylist`, `stylist`, `black-cowboy`.

Demario and Luigion's costs, bodies, Mushroom bonuses, echo restrictions, and powered form are unchanged. A trial of cheaper Demario and a larger normal Luigion Mushroom bonus did not improve the matched result and was discarded. YN ATV Lord's cheaper-cost trial was also discarded: the movement shell already scored very strongly before that change.

## Evidence

Pinned baseline: `d33f9dc3b80de8bb587730d22dc3e3fde0516507`.

Greedy comparison: nine lineups, three opponents (Fire, Air, coherent control), rotations 0/5, tiers 0/3, mirrored seats, identical district seed, SQUABBLE enabled. 216 baseline + 216 candidate games. Scores count draws as half a win.

| Lineup | Baseline | Candidate |
| --- | ---: | ---: |
| Original Cellblock | 16.67% | 16.67% |
| Cellblock Pressure | 41.67% | 43.75% |
| Original Demario/Luigion | 4.17% | 2.08% |
| Mushroom Garden | 66.67% | 68.75% |
| Detectives | 56.25% | 64.58% |
| Wonderland | 58.33% | 58.33% |
| Earth tax | 43.75% | 43.75% |
| Homeless | 37.50% | 37.50% |
| Earth rides | 97.92% | 97.92% |

A second, seeded-legal policy compared old and recommended lineups under candidate rules for another 96 matches: original Cellblock 35.42%, Cellblock Pressure 43.75%, original Demario/Luigion 39.58%, Mushroom Garden 58.33%. This supports the composition direction across two policies, but is not a second baseline-vs-candidate card-rules comparison.

Most of the recommended-deck gain is composition, not individual buffs. The original lineups remain weak. The small greedy drop for original Demario/Luigion is retained transparently; stronger support effects can change the bot's choices. These deterministic samples are not live-player win rates or proof that individual cards are balanced. Human sequencing and fun remain unverified.

```sh
pnpm --filter @workspace/scripts exec tsx src/crew-support-audit.ts --baseline
pnpm --filter @workspace/scripts exec tsx src/crew-support-audit.ts
pnpm --filter @workspace/scripts exec tsx src/crew-support-audit.ts --seeded
```

## Verification

- 153 focused tests pass, including both owners, upgrade tiers, valid/invalid inmate conditions, fallback vs cleanse, disabled sources, multiplayer projection, deterministic transcripts, and stale room handling.
- Full application suite under Node 24: 700 pass; the same two existing stale story-version and Earth-card-count assertions fail. This patch changes neither value.
- Library, application, and audit-script typechecks pass.
- Production build and entry-bundle budget pass.
