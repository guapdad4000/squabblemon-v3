# SQUABBLEMON

A three-district competitive card battler prototype built around the Squabblemon roster.

This repository is a consolidated snapshot of the design, gameplay prototype, balance lab, balance-patch experiments, playtest build, original roster data, and visual references developed through September 6, 2026.

## Start here

### Play the current prototype

Open `index.html` in a browser, or serve the repository with any static web server.

The current playtest contains:

- three contested districts
- six-round matches
- 1 to 6 Hype economy
- face-down commitments and reveals
- type clashes and speed-based reveal priority
- Move, Lock, Silence, Cleanse, Poison, Freeze, Copy, and Protect gameplay
- seven starter archetype decks
- Patch 0.2 control balance
- Patch 0.3 focused experiments and RC testing variants
- CPU opponent
- SQUABBLE / Clout risk mechanic
- OG Concrete and Gold Foil visual themes
- local playtest telemetry and JSON export

No build step is required for the standalone prototype.

## The seven starter decks

1. **THE BLOCK IS HOT** — turf and lane control
2. **SLIDE THRU** — movement and late lane reassignment
3. **WHO YOU KNOW** — cheap-card combo, resource generation, and networking engines
4. **RECEIPTS** — information, Silence, Poison, and disruption
5. **CRASHOUT SEASON** — comeback mechanics and deficit conversion
6. **GOOD VIBES ONLY** — Cleanse, Protect, sustain, and defensive scaling
7. **COMPOUND INTEREST** — long-term growth and Power scaling

## Current balance state

Patch 0.2 was the major corrective pass after the first 28,000-game baseline.

The baseline cross-match deck spread was approximately **28.4% to 68.4%**. The Patch 0.2 test compressed that to approximately **46.6% to 54.8%**, while leaving SLIDE THRU close to neutral.

The three remaining focused matchup outliers entering Patch 0.3 were:

- COMPOUND INTEREST vs GOOD VIBES ONLY
- WHO YOU KNOW vs GOOD VIBES ONLY
- WHO YOU KNOW vs CRASHOUT SEASON

Patch 0.3 therefore uses focused deck-tech experiments instead of broad global buffs and nerfs.

## Patch 0.2 card changes

- **Techbro Rich**: 4/5 → 4/4. Hype conversion capped to 1 Hype for +2 Power.
- **Live Streamer**: 2/2 → 2/1. First two cheap plays grant +1; third cheap play generates Stan.
- **Stan**: 0/1 → 0/0, with +1 if Live Streamer remains on board.
- **Snitch**: 2/2 → 2/3.
- **All Jokes Roaster**: 2/2 → 2/3.
- **Closet Nerd**: 3/2 → 3/4.
- **Scammer**: 4/2 → 3/3.
- **Serial Shooter**: 5/7 → 4/5; now Silences the highest-Power enemy in its district and gives it -2 Power.

## Patch 0.3 experiments in the playtest

- **A1**: GOOD VIBES ONLY swaps Smoker Jr for Techy.
- **A2**: GOOD VIBES ONLY swaps Functional Addict for Closet Nerd.
- **B2**: Rastamon receives a +1 fallback when Natural Cure has nothing to Cleanse.
- **C1**: CRASHOUT SEASON swaps Functional Addict for All Jokes Roaster.
- **C2**: Baby Momma checks total-board card deficit instead of only local lane population.
- **RC1**: combines the leading A2 + C1 deck-tech approach for human playtesting.

## Balance telemetry principles

Card analytics must preserve `originDeck`, `originalOwner`, and `currentController` independently. `originDeck` and `originalOwner` are immutable. Control-changing mechanics such as Coone may only alter `currentController`.

## Balance goals

- deck overall win rate: **45–55%**
- preferred matchup ceiling: **57/43**
- hard investigation threshold: **60/40**
- mirrors: **48–52%**
- reveal-priority advantage: **under 3 percentage points**
- opening playability: **above 90%**

## Visual direction

- **OG Concrete**: dark tactile concrete, printed archive typography, street-material texture
- **Polished Metallic Gold Foil**: premium embossed framing, reflective foil highlights, rarity framing, animated glints, black-and-gold luxury finish

The target is premium AAA mobile-card-game polish while keeping Squabblemon's own street-social-combat identity.

## Full archive

A complete 184-file project snapshot with prior prototypes, balance labs, Patch A-E experiment folders, CSV/JSON results, screenshots, visual references, original roster data, and older zip bundles was also packaged as `squabblemon-complete-2026-09-06.zip` for archival handoff.

## Next steps

1. human playtest RC1 across all seven starters
2. capture qualitative feedback alongside telemetry
3. finish Patch 0.3 10K-per-pairing validation
4. move card effects into one canonical data schema shared by prototype and simulator
5. replace external image URLs with controlled local/CDN assets
6. implement production-quality foil shaders, reveal cinematics, deck collection, and matchmaking state
7. add automated regression tests for card effects and telemetry
