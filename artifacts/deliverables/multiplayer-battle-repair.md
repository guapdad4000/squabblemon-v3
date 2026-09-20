# Multiplayer battle repair — September 19, 2026

## Reproduced

The existing two-account browser test failed on the phone: the selected hand card intercepted taps intended for SQUABBLE. The full-width district headings also made the arena roughly 1,400px tall on an 844px phone, placing the hand below the visible board. Card image requests succeeded; the unusable layout prevented reliable play. The API also rejected one Ready/rematch vote when both clients voted from the same revision.

## Changed

- Rebuilt the online arena as a single viewport with dedicated board, hand, and action rows. Portrait phones show three compact district bands with Rival/You sides; desktop shows three district columns. District rules and match history remain accessible in dialogs.
- Hand cards retain their artwork on the opponent's turn. Selected cards cannot overlap the action controls. Failed plays keep their selection; turn changes clear it.
- Scoped room/list caches to the player profile. Active rooms refresh every 800ms. Initial transient failures continue polling; reconnect, foreground, and page restoration refresh the room.
- Requests abort after eight seconds, stale connections disable actions, and move retries reuse the original request ID. The authoritative database still owns the board, turn, costs, and scores.
- Ready/rematch accept the rival's one intervening vote. Card plays and end-turn commands retain strict revision checks.
- Added shared multiplayer engine checks to the release build, alongside the existing summoner regression gate.

## Verification

- Shared engine and real PostgreSQL-compatible route checks: 8 passing, no skips. Covers private hands, legal turns, concurrent writes, retry deduplication, both SQUABBLES, timeout, full results, and simultaneous Ready/rematch revisions.
- Two independent browser accounts against the actual local API: full six-round match, mobile touch and desktop input, matching rendered cards/Hands/scores after every action, decoded portraits, and mutual rematch.
- Fault injection: lost accepted-action response, delayed older poll, rejected move retry, failed initial polls after reload, and an offline rival catching up after a move.
- Viewport and hit-target checks: desktop 1280×900, phone 390×844, and small phone 320×740. All districts, hand, and action buttons stay visible without vertical page scrolling; selected portraits do not intercept controls.
- This is browser/device emulation with isolated test accounts, not a physical phone/network load test. Existing friend-match rules, 75-second turns, and economy are unchanged.

Run the disposable host with scripts/online-preview.mjs and the two-session check with artifacts/squabblemon/e2e/verify-online.mjs. See online-friend-matches.md for database setup.

## Published release

Production: https://squabble.today
Deploy: 6aaf474f5b7bbc74fe221b79
Release gates: 7 summon checks and 7 multiplayer engine checks passed, plus frontend/API type checks and bundle checks. Live GameApp-CtkbQlQ7.js and GameApp-BS6DHf3n.css exactly match the built release. Live health returned 200; signed-out multiplayer returned 401 as expected.
