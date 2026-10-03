# Base-level playtest acceptance — local rules 46

This local candidate is not committed or published. The games below used tier 0 with GUAP and FOLKS excluded from every submitted roster. Ruby Shades remains in Blood. They are automated policy outcomes, not human win rates.

The shared-screen browser fixture now offers Blood / Crips, Combo / recommended Counterplay, and Compound / Crips. Its matchup selector sets tier 0 for the two new matchups. It supports both player sides, deterministic seed entry, seat swapping with the same draws, notes, and JSON export with command replay verification. The locally launched build is at `http://localhost:5179/e2e/rivalry-playtest.fixture.html` while its dev server is running.

## Fresh multiplayer-handler sample

Each entry is 48 games across three policies, two deck owners and two opening seats. The seed prefix `acceptance-20261003` was not used to select the local recipes. Draws count as half a win.

| Subject | Opponent | Score |
| --- | --- | ---: |
| Recommended Counterplay | Combo | 77.08% |
| Recommended Counterplay | Compound | 85.42% |
| Recommended Counterplay | Voltage | 81.25% |
| Recommended Counterplay | Elemental Fire | 85.42% |
| Compound | Crips | 30.21% |
| Compound | Blood | 37.50% |
| Compound | Starter Block | 39.58% |
| Compound | Starter Vibes | 40.63% |

The recommended Counterplay crew is broadly too strong in this sample, and Compound remains weak against Crips. The earlier 85.42% Combo result against `focus-counterplay` came from the legacy comparison shell; that shell is now labeled explicitly in the balance lab. These findings do not justify a blanket card-power increase. The next balance decisions should address the recommended Counterplay recipe's broad strength and Compound's ability to survive Crips' pressure, then repeat both samples with people on each seat.

The browser automation makes legal plays through the mounted Battle UI and verifies exported replay and deck membership. It is a UI regression check, not strategic or human balance feedback. Human notes can be entered in the fixture and exported with a completed game.

Mounted browser verification passed for both new matchups on desktop and phone: four browser tests, each completing both seat assignments at tier 0 and replay-verifying the exported game. The existing Blood/Crips shared-screen regression passed on desktop. The first phone Counterplay attempt collided with a concurrent Playwright run's trace directory; it passed when rerun alone with a separate output directory. Rivalry fixture TypeScript and frontend TypeScript passed.

Evidence: `scripts/results/combo-base/counterplay-acceptance-v46.json` and `compound-acceptance-v46.json`.

## Follow-up recipe check

Compound now uses Snow Bunny in Wifey's starter slot. On a new paired seed prefix (`acceptance-snow-20261003`), each recipe played 48 tier-0 games per opponent with the same policies, owners, seats and draws:

| Compound opponent | Wifey | Snow Bunny |
| --- | ---: | ---: |
| Crips | 27.08% | 56.25% |
| Blood | 27.08% | 20.83% |
| Block | 50.00% | 50.00% |
| Vibes | 53.13% | 45.83% |
| Combo | 48.96% | 51.04% |
| Voltage | 34.38% | 31.25% |
| Recommended Counterplay | 22.92% | 35.42% |
| Elemental Fire | 68.75% | 62.50% |

The Snow recipe directly addresses Compound's Crips weakness without a broad field increase. Blood remains a weak matchup, and its result varied between the exploratory and new seeds. The mounted Compound/Crips browser scenario passed on desktop and phone with both seats, replay verification and tier 0. The focused tests, frontend TypeScript and production build pass.

Counterplay remains the release blocker. With Snow Compound on the new seed, the current recommended Counterplay crew scored 70.83% against Combo, 61.46% against Compound, 81.25% against Voltage and 95.83% against Fire. A previously explored alternative crew (`counter,stud,pinaynurse,wifey,rastamon,gothkid,gamer,soulfood,cognac,bustdown`) improved those scores to 52.08%, 67.71%, 58.33% and 79.17%, but it scored 89.58% against Block and 87.50% against Vibes on the same seeds. Other one- and two-slot trials either left the broader strength intact or collapsed against Blood/Crips. No Counterplay recipe change was accepted from this round.

Replacing the alternative crew's Bust-Down Watch protection with Plug initially scored 47.92% against Crips and Blood, but its second seed set scored 66.67% against Crips, 97.92% against Block and 93.75% against Fire. This trial was rejected for its large seed sensitivity and continued lopsided matchups.

The balance candidate remains uncommitted and unpublished. These automated policies are useful comparisons, not player win-rate estimates.

Follow-up evidence: `compound-wifey-acceptance-v46.json`, `compound-snow-acceptance-v46.json`, `compound-wifey-field-acceptance-v46.json`, `compound-snow-field-acceptance-v46.json`, `counterplay-after-snow-acceptance-v46.json`, `counter-middle-acceptance-rivals-v46.json`, `counter-middle-acceptance-field-v46.json`, `counter-no-closer-rivals-v46.json`, `counter-no-closer-field-v46.json`, `counter-no-closer-holdout-rivals-v46.json`, and `counter-no-closer-holdout-field-v46.json` in `scripts/results/combo-base/`.

## Accepted Counterplay correction

The unstable crew swaps were replaced with one bounded card correction. Shotta now opens for 2 Hands and keeps two cross-district encores at 1 Hand each, once per round. This aligns the runtime opener with its authored 2-Hand definition while preserving the sequencing identity. Its former runtime ceiling was 7 total damage; the corrected ceiling is 4.

Two fresh, independently seeded 384-game samples produced:

| Counterplay opponent | Set A | Set B |
| --- | ---: | ---: |
| Crips | 43.75% | 56.25% |
| Blood | 64.58% | 65.63% |
| Block | 88.54% | 77.08% |
| Vibes | 72.92% | 61.46% |
| Combo | 59.38% | 58.33% |
| Compound | 52.08% | 62.50% |
| Voltage | 35.42% | 41.67% |
| Elemental Fire | 78.13% | 87.50% |

The correction removes Counterplay's broad 70–96% results without making it collapse against Blood or Crips. Block and Fire remain favorable automated matchups, while Voltage is unfavorable. That matchup shape is acceptable for a counter deck and materially more stable than the rejected recipe swaps. Strategic human play remains the next source of tuning evidence rather than a blocker for packaging this patch.

Accepted correction evidence: `counter-shotta1-a-rivals-v46.json`, `counter-shotta1-a-field-v46.json`, `counter-shotta1-b-rivals-v46.json`, and `counter-shotta1-b-field-v46.json` in `scripts/results/combo-base/`.

Final validation: 200 focused engine, card, Combo and workshop tests pass; the dedicated balance patch suite passes 8/8; frontend and audit-script TypeScript pass; the production build and all entry-bundle limits pass; and the mounted Counterplay matchup passes on desktop and phone with both seats and replay verification. The full frontend suite passes 1668/1672. Its four failures are the same unrelated existing failures: one missing supplied portrait asset, the Hot Off the Griddle expectation, and two campaign/story content expectations.
