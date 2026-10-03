# Combo support follow-up — rules 46

Local candidate; not committed, pushed or published.

## Changes

Gamer's City Tour now gives the weakest ally in each other district **+2 Hands**, up from +1. At most two allies benefit per reveal; the local district is excluded. Cost remains 3 Motion and base Hands remain 3. Its ongoing disruption trigger is unchanged.

The earlier local changes remain: Live Streamer is 2 Motion / 3 Hands; Techbro Rich is 3 Motion / 4 Hands with unchanged Burn Rate borrowing and repayment. XP progression is unchanged. Existing Gamer training payout behavior was preserved, including its payout on an unsilenced empty reveal; this pass does not redesign training.

Ruby Shades is in Blood. GUAP and FOLKS are excluded from all matchups in this pass. Historical reports remain unchanged.

## Paired base-card evidence

384 games: two previously used four-seed sets, four opponents, three policies, both owner assignments and opening seats. Every play uses the actual multiplayer command handler and is compared with its canonical preview. These reused seeds are paired comparisons, not a new untouched holdout. Draws count as half a win.

| Combo opponent | Set A before | Set A after | Set B before | Set B after |
| --- | ---: | ---: | ---: | ---: |
| blue | 10.42% | 6.25% | 29.17% | 18.75% |
| red | 10.42% | 8.33% | 8.33% | 12.50% |
| starter-block | 41.67% | 45.83% | 8.33% | 20.83% |
| starter-vibes | 29.17% | 29.17% | 35.42% | 29.17% |

Both samples improve against Block, but other matchups remain mixed. This supports testing the stronger spread-board payoff with people; it does not establish overall balance improvement or competitive parity with Blood/Crips. Gamer also appears in other decks; the whole metagame has not been simulated here.

## Validation

- 33 Combo tests pass, covering both owners, tiers 0–3, weakest remote targeting, no local payout, empty districts and Silence.
- 103 focused engine, Combo, parity and card-budget tests pass.
- Frontend and browser-fixture TypeScript pass.
- Production build and all entry bundle limits pass.
- Full frontend suite: 1665/1669 passed. The same four known unrelated failures remain (missing portrait source, Griddle expectation, two transcript expectations).
- New Gamer browser scenario passed on desktop and phone. Combined run passed 3/4 initially; the existing phone Techbro/Streamer scenario timed out, then passed on the isolated rerun (1/1).

Raw evidence: scripts/results/combo-base/support-v46.json and support-confirm-v46.json. Their predecessors are tempo-v45.json and tempo-holdout-v45.json.
