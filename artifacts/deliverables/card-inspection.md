# Hold cards for details

Published to [squabble.today](https://squabble.today) in deployment [6aaca82a9de463b4313ee84e](https://app.netlify.com/projects/squabblemon-triple-lane/deploys/6aaca82a9de463b4313ee84e).

Hold a card for 450 milliseconds to open its details using mouse, touch, or pen. Desktop users can also right-click or press Alt+Enter on a focused card. Ordinary taps retain their existing selection behavior; dragging still plays cards. Movement and interrupted presses cancel inspection, and releasing a completed hold cannot accidentally select, replace, or play the card.

Available across battle hands and boards, multiplayer, the deck editor, collection, crew previews, and pack rewards. Hand cards remain inspectable while waiting for the opponent or when unaffordable. Closing details restores focus without scrolling the hand. Details outside battle use the cached player profile for ownership, XP, equipped variants, and upgrades.

## Verification

- The browser fixture passed 31 gesture checks at both the default browser viewport and 390 x 844. These exercise mouse, touch, and pen holds, release suppression, movement and interruption cancellation, quick taps, solo drag-to-play, deck lineup preservation, unavailable hand cards, opponent-turn inspection, and multiplayer inspection.
- Native desktop right-click and Alt+Enter checks passed.
- All 26 battle component regression tests passed, along with TypeScript checks and the production build. Entry JavaScript remains 189.8 KiB against the 475 KiB budget.
- On the published game, right-click and Alt+Enter opened Leroy's details in the existing bruce deck with the current level, XP, Golden Glow ability, and upgrades. Closing preserved the unselected lineup slot. No browser errors were reported and no deck save was performed.
- Production health returned 200; anonymous player bootstrap returned 401; live HTML matched the built HTML.

The touch checks used browser-generated pointer sequences at a phone-sized viewport; physical phone testing was not performed.

Fixture: `artifacts/squabblemon/e2e/card-inspection.fixture.html` and its adjacent TSX file. Verification record: `screenshots/card-inspection-audit.json`.
