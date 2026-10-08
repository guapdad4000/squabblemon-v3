# Fitness and Fire/Cypher follow-up

Implemented over the existing local v50 full-roster candidate. No commit or push. GUAP is unchanged. The previous 18-card printed-stat pass remains intact.

- Fitness Girl: after a successful move, if no ally needs injury/Burn recovery, give the weakest other local ally +1 Hand. No extra bonus alongside recovery, and no bonus on failed movement.
- Personal Trainer: the existing three-district circuit now stays available through the next two rounds, rather than only the next round. Distinct-district requirement, original rewards and per-side limits stay intact.
- Dance Circle Captain: any friendly character's first successful move can establish the destination. A second distinct character moving there earns the original +2 Hands and Protection once per round. No payout for repeatedly moving the same unit.
- Corner Coach: if no safe coachable ally is present, give the weakest other local ally +1 Hand. No new entrance IDs enter the retry whitelist.

## Evidence

The first fixed-seed check contained 240 current-candidate scenarios per version (the existing runner also runs the earlier printed-stat arm). Fitness 25% -> 26.25%; Fire 16.25% -> 20%; Music, Relationships, Dark and Wave 7 unchanged. These files remain in /tmp/synergy-before and /tmp/synergy-after, not required for the durable report.

Durable before/matches.json and after/matches.json contain 360 games per version: Fitness, Fire and Wave 7 versus Water, Mushroom, Air, Light and Dark; three new seeds/draw rotations, both seats, base/full training, greedy/seeded-legal policies. Paired scores: Fitness 11.67% -> 11.67%; Fire 10.83% -> 12.08%; Wave 7 8.75% -> 8.75%. No simulation exceptions. These modest improvements do not establish parity or statistical significance. Generic bots do not deliberately execute multi-step circuits. Fire replaces GUAP and Folks for the diagnostic audit; do not read this as the actual live GUAP-deck win rate. The Fire shell does not include Captain, so these scores do not establish Captain's matchup improvement; its movement changes are verified by targeted two-owner fixtures and existing movement regressions.

## Validation

1,840 application checks, 24 multiplayer checks and 318 targeted checks passed. Shared declarations and frontend type checks passed. Production build passed; entry/GameApp/Home bundle budgets passed. GUAP's full definition matches the saved baseline. Desktop/phone Collection inspectors verified all four cards' Motion/Hands and produced eight screenshots without page exceptions. No battle screenshot or human matchup test was performed.

See remaining-33-character-concepts.md for a support-first draft that allocates the 33 remaining collectible slots toward 300. These characters are proposals, not implemented catalog entries. Start with inexpensive movement enablers before finishers, and validate archetype recipes with movement-aware playtesting.
