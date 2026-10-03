# The Last Waffle — Squabble House story arc

This release adds `special-squabble-house` as the ninth Story presentation. The six connected chapters contain 24 progression nodes, six ten-second MiniMax H3 films, illustrated dialogue with twelve supplied cast identities, six diner puzzles, Blood and Crips rival battles, a vintage poster, and a custom diner map. Chapter one is available immediately; later chapters open after the previous ending.

| Chapter | Puzzle | Rival | Battle-gated House reward |
| --- | --- | --- | --- |
| The Last Waffle | Rebuild the breakfast order | Red's Blood crew | Squabble House Server |
| The Receipts | Sort the final charges | Blue's Crips crew | — |
| Family Discount | Seat the booth | Red OG's Blood crew | Squabble House Cook |
| Hands on the Clock | Meet grill deadlines | Blue Titan's Crips crew | — |
| Wet Floor. Dry Humor. | Follow dry floor tiles | Combined rivals | Janitor |
| The Real Thief | Correct camera clocks | Combined rivals | Squabble House Manager |

The story follows film → 2D opening → puzzle → required battle → closing dialogue. Official story payouts apply to every node: at least 100 Clout and one Street Pack Ticket; chapter finales pay at least 250 Clout and ten tickets. Puzzles may be solved or explicitly skipped to advance, but no House card is awarded until the required battle is won and the closing scene is completed. The server records each claim once and converts an already-owned House card to Style Shards. Temporary staff arrive in the player's hand on rounds one and two so new players can try their abilities without receiving permanent ownership. All six fights have authoritative winning replays with the unupgraded Rookie Mentor crew.

The opponent decks use current Red Set and Blue Set cards from the Blood and Crips balance release, including their OGs and dogs in later chapters. The first encounter gives the player extra House territory support so the opening fight remains approachable for a starter crew. Its rules and advantages are visible in the battle briefing.

The event announcement is prepared as patch 1.9 in `docs/releases/squabble-house-1.9.json` and the private patch desk. Its vintage banner appears on Events and in the matching Mailman letter. The letter links directly to the new Story presentation. This patch grants no separate mail gift; House cards and story payouts are earned in the arc.

`ASSET_MANIFEST.json` records the hashes of the shipped art, banner, and all six film files. `../squabble-house-openart/GAME_MEDIA_MANIFEST.json` records each completed provider job and game encoding. Native source media and generation requests remain in the local OpenArt deliverable directory; only optimized game media is included in this release checkout.

The independently designed puzzle audit and final local recheck are in `PUZZLE_AUDIT.md`. The test evidence is in `VERIFICATION.json`. Browser checks use fixture transport; database reward checks use an owned disposable PGlite instance. Neither fixture substitutes for a real signed-in player's final production review.

Key files:

- `lib/squabblemon-engine/src/storySquabbleHouse.ts`: scripts, encounter decks, rewards, and puzzles.
- `artifacts/squabblemon/src/pages/game/Story.tsx` and `story/`: theater, map, films, dialogue, and puzzle instruments.
- `artifacts/squabblemon/public/assets/story/squabble-house/`: cast, environments, puzzle art, and films.
- `artifacts/squabblemon/public/assets/events/last-waffle-patch-1-9.webp`: official event/mail banner.
