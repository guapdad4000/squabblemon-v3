# Kumite Breakthrough — player guide and rule reference

Status: source-inspected guide for the current Breakthrough rules. Public PvP remains gated. The current internal preview is local CPU practice and grants no account rewards. This document does not announce a release date, matchmaking availability, ticket entry fee or trophy grant.

## Player-facing quick explanation

Three lanes. Three minutes. Two breaches to win.

Both sides play at once. Drag a card into a lane, or tap the card then the lane. Pay its yellow Motion cost and your fighter enters from your base. Have enough Motion for another card? Deploy it immediately, including into the same lane. An animation is never the deployment cooldown.

Opposing fighters collide. Each normally loses the other’s current effective Hands at the same time. With no effects or defenses, 7 Hands against 5 leaves the stronger fighter marching with 2. Equal Hands normally defeats both. Abilities and defenses change these outcomes; the in-battle card explanation shows the rules adapted for this mode.

Reach The Opps’ base to score a breach. The scoring fighter leaves the field. Two scoring fighters win, including two through the same lane. Support and Action cards resolve their effect instead of marching or scoring. Some summoned pieces cannot breach.

For the final 30 seconds, Last Stand stops all draws. Motion continues. Use what remains in your hand and protect your lead. At 0:00, most breaches wins; if tied, most surviving effective Hands wins; if still tied, draw.

## Exact baseline values

| Rule | Current value |
| --- | --- |
| Lanes | 3 |
| Match clock | 180 seconds / 3:00 |
| Simulation tick | 50 ms |
| Unimpeded baseline full-lane travel | 25 seconds; card effects can alter movement |
| Starting Motion | 4 |
| Baseline refill | 0.5 Motion per second / 1 every 2 seconds |
| Motion cap | 9 |
| Opening / maximum ordinary hand | 4 cards |
| Draw cadence | 1 card every 3 seconds, if there is room and a ready card |
| Ordinary return delay | 8 seconds, then join the back of the draw queue |
| Last Stand | Final 30 seconds; draws permanently locked |
| Early win | 2 total base breaches, across any lanes |
| Timeout order | Breaches, then total effective Hands on the field, then draw |
| Squabble | Once per side per match; 2× deployment base Hands; unchanged Motion cost |

Values come from `RULES`, `createGame`, `releaseReinforcements`, `resolveContacts` and the end-of-tick result logic in `lib/squabblemon-engine/src/breakthrough.ts`. The in-game guide imports `RULES` rather than separately hard-coding its tunable numeric values. Three lanes and two breaches are currently engine invariants.

## Decks and effects

- Use a valid saved deck of ten unique owned cards with a valid captain. The internal loaner is temporary and does not add ownership. Base stats apply; collection upgrades do not. Variants remain visual choices.
- Fighter Hands are both collision power and remaining durability. Bonuses, damage, Protection, immunities and other card effects affect the actual result. The simple 7 versus 5 example assumes no such effects.
- Deploying is synchronous and does not wait for friendly spacing or animation completion. Friendly followers line up at the base and march behind allies. Enemy pressure does not disable entrance. Individual card lane restrictions, affordability and required choices still apply.
- A required choice is confirmed before spending Motion. A stale or invalid choice is rejected; the engine revalidates against current state. Effects resolve according to their authored targeting; not every card offers a freely chosen target.
- Cards have explicit real-time adaptations. Effects referring to rounds use authored timed beats, commonly 10 seconds. Final-round conditions refer to Last Stand. Exact timing and limits belong to each in-battle explanation rather than the old round-based card wording.
- A normal defeated or scoring deck fighter, or a played Action, waits 8 seconds before entering the draw queue. It must still wait its turn and an open hand slot. Summoned pieces are not added to the collectible draw loop. Card-specific returns, transforms or other effects can override normal behavior.
- Squabble is armed before a fighter deployment. It doubles deployment base Hands once per match; it does not double every later effect bonus. Actions cannot Squabble. Failed plays do not consume the use. A returned fighter does not replenish the match-wide Squabble use.

## Important edge cases

- Freeze affects only its target. It stops the fighter’s movement and active abilities, but friendly teammates can pass. Stored Hands remain displayed, while effective combat and timeout Hands are 0. A positive-Hands contact defeats a frozen fighter unless a defense prevents it. Duration and cleanse interactions are card-specific.
- Silence and Weaken disable active abilities without zeroing Hands or stopping movement. Protection and immunities can change whether statuses or damage land. Read the exact card explanation.
- A breach lead wins at timeout even against a larger enemy field total. Held cards, queued cards and returning cards add no timeout Hands. Frozen units add 0 effective Hands.
- Simultaneous second breaches on the same 50 ms simulation tick are a draw. A second breach otherwise ends the game immediately; a stronger field cannot reverse it afterward.
- Last Stand locks all draws, including card-effect draws. If a card extends the clock after Last Stand starts, draws stay locked. Motion continues to refill.
- Local CPU practice pauses for its menu or a hidden tab and resumes explicitly. This is practice behavior, not a promise that live PvP can pause.

## Presentation and availability

`BreakthroughHowToPlay.tsx` is shared by the saved-deck lobby and the existing battle-menu help. It uses numbered fight beats, a collision example, native expandable detail sections and the existing brick texture/fonts. It owns no timers, API calls, media playback, rewards or dialog. The Arena menu keeps its existing dismissal and focus behavior.

The same guide can be lazy-mounted in a public event/release information surface while public gameplay stays gated. It explicitly labels the beta as in preparation and the current preview as CPU-only with no account rewards. Enablement and reward amounts must come from the authoritative release policy and server settlement, not guide copy.
