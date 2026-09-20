# Dr. Fade’s first session

New accounts follow one path: profile → Safehouse tour → first collection → guided deck swap → four-round tutorial → welcome reward → Chapter 1.

## Progress and compatibility

- Existing server onboarding steps remain authoritative. No database migration is required.
- Choosing the foundation during the tutorial grants twenty cards once and preserves the tutorial step.
- The first crew is saved before battle. A verified tutorial with that crew qualifies for the welcome reward; a second practice match is unnecessary.
- Accounts already at the old crew/reward steps retain their existing path. Completed accounts keep their progress.
- Refreshing restores the saved crew or earned reward from the server. An unfinished match can be restarted without charging currency.

## Teaching and difficulty

- Supplied Dr. Fade artwork is stored unchanged in artifacts/squabblemon/public/assets/tutorial.
- The guide points at actual controls, blocks unrelated pointer/keyboard actions, and advances on the required interaction.
- Safehouse lessons explain home, story, collection versus deck, and the crew table.
- The deck lesson teaches a ten-card lineup, opening draw order, a replacement, and saving.
- Four battle rounds teach cost, district strength, spreading across districts, ending turns, banking one Motion, and SQUABBLE.
- Rookie Road v2 uses Bodega, The Trap, and VIP Section. The rival starts with one card and one Motion; later Motion is reduced. It is explicitly labeled a training encounter.
- The server stores and replays the same encounter and district snapshots. Regular practice and campaign difficulty are independent.
- The chapter selector displays unlocked chapters; later chapters appear when earned.

## Verification

- pnpm --filter @workspace/squabblemon test
- pnpm --filter @workspace/api-server test (owned temporary database; full campaign and reward idempotency)
- pnpm --filter @workspace/squabblemon test:player-journey (Edge, phone and desktop; actual UI choices with server replay in the test fixture)
- ROOKIE_SIZE=small selects the 320px browser check.
- All ten starter replacement options pass legal-win and tutorial-milestone checks.

Browser fixtures and isolated database tests do not measure real-player comprehension. Use the existing tutorial-step analytics and first-battle outcomes to evaluate new-user completion and drop-off after release.

## Reconciled release

The tutorial is combined with the live checkout’s inventory, soundtracks, reward artwork, foil treatments, expanded districts, KYLE and STOCKZ. Existing campaign rarity and upgrade fixes are retained. Character/video revisions match file hashes. Story v1 seeds retain their original sixteen-district pool so new locations cannot silently reshuffle authored battles. The Cheese Has Terms grants two extra opening Motion. Mama Has the Floor, Auntie’s Setup, The Function, Snitch’s Roll Call and OG Uncle have one less rival Motion on later rounds; The Bar Fight has two less. These targeted adjustments preserve their phases and lane rules while allowing the guided starting deck to win.

The source of truth is GitHub main in guapdad4000/squabblemon-v3. Netlify automatically deploys main, and the same reconciled checkout can be published with the documented CLI command. See README for deployment details.
