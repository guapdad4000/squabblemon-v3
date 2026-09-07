# SQUABBLEMON

A three-district competitive card battler prototype built around the Squabblemon roster.

This repository is the active GitHub home for the current prototype and handoff materials.

## Current handoff status

- 36-character playable roster
- 7 starter archetype decks
- Patch 0.2 balance pass completed
- Patch 0.3 focused human-test variants included in the source bundle
- 20 / 36 characters wired to the new unified transparent production-art style
- OG Concrete and Gold Foil UI themes
- Yellow Liquid Orb wired to Hype
- Flame Orb wired to SQUABBLE
- balance-lab history, telemetry notes, and implementation docs preserved in the final handoff archive

## Start here

- `HANDOFF.md` — current project state and transfer notes
- `handoff/SQUABBLEMON_DEV_SOURCE.zip` — current modular prototype source, docs, sprite map, and Patch 0.3 code

The complete binary art library is delivered in the final project handoff ZIP because the chat GitHub connector is not suitable for pushing the full ~150 MB transparent master-art package as normal repository contents.

## Seven starter decks

1. THE BLOCK IS HOT — turf / lane control
2. SLIDE THRU — movement
3. WHO YOU KNOW — combo / resource generation
4. RECEIPTS — disruption / information
5. CRASHOUT SEASON — comeback
6. GOOD VIBES ONLY — sustain / protection
7. COMPOUND INTEREST — growth / scaling

## Balance targets

- starter overall win rate: 45–55%
- preferred matchup ceiling: 57/43
- hard investigation threshold: 60/40
- mirrors: 48–52%
- reveal-priority advantage: under 3 percentage points
- opening playability: above 90%

## Next production steps

1. finish the remaining 16 unified production character illustrations
2. split Battle FX reference art into true animation atlases
3. move prototype game-state logic into testable production reducers
4. persist telemetry server-side instead of localStorage
5. run the Patch 0.3 release-candidate 10K-per-pairing validation
