# SQUABBLEMON

A three-district competitive card battler prototype built around the Squabblemon roster.

This repository is the active GitHub home for the current prototype and handoff materials.

## Current handoff status

- 36-character playable roster
- 7 starter archetype decks
- Patch 0.2 balance pass completed
- Patch 0.3 focused human-test variants included
- OG Concrete and Gold Foil UI themes
- 20 / 36 characters wired to the new unified transparent production-art style
- Yellow Liquid Orb wired to Hype
- Flame Orb wired to SQUABBLE
- lane-local Battle FX popups now wired for impact, heal/cleanse, money/economy, poison, copy/scam, report/silence/control, movement, type clash, and SQUABBLE moments
- balance-lab history, telemetry notes, and implementation docs preserved in the final handoff archive

## Start here

- `HANDOFF.md` — current project state and transfer notes
- `handoff/SQUABBLEMON_DEV_SOURCE.zip` — modular prototype source bundle already stored in the repo

The complete binary art library is delivered in the final project handoff ZIP because the master transparent art package is too large for the chat GitHub connector to push as normal repository contents.

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

## Art production

The remaining 16 unified character-art briefs are locked in the final handoff under `docs/REMAINING_CHARACTER_BRIEFS.md`. The prototype automatically uses legacy sprite fallbacks until each new local illustration is dropped into the sprite map.

## Next production steps

1. finish the remaining 16 unified production character illustrations
2. promote the prototype FX popup router into trimmed runtime atlases / frame sequences
3. run Patch 0.3 RC validation at 10K per pairing
4. move game-state logic into testable production reducers
5. persist telemetry server-side instead of localStorage
