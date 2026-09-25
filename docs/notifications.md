# Player attention indicators

Small red exclamation marks identify sections with activity; small red dots identify individual unseen items. The header bell opens an accessible native dialog with direct links. Indicators never animate or interrupt play.

Sources: owned cards, character banners, unlocked cosmetics and variants, new store offer IDs, refreshed/claimable missions, unread mail or unclaimed mail gifts, Growth Lab/check-in rewards, the Chapter 5 Mythical, newly gained bag resources, and the daily Straight to the Back attempt allowance.

Item reads persist per player in local storage on this device and sync across tabs. They are presentation state, not reward authorization. Bell clicks do not acknowledge items. Links identify the exact card, finish, letter, cosmetic tab, mission, or offer; attempt links open Straight to the Back. A visible destination must remain at least half in view for 700 ms before it counts as seen. Cards keep their dot while being viewed and clear after clicking away, scrolling out, closing their inspector, or leaving the page. Bell-targeted cards receive a static gold outline and scroll into view, overriding remembered tabs and scroll positions. Other visible items clear after that viewing interval. Offscreen items and failed/missing destinations stay unread. Merely entering a section never clears its entire list. The tray offers an explicit bulk acknowledgement; claimable rewards and mail gifts remain until resolved. New mission reset keys and the server's UTC date reintroduce refreshed notices. New offer IDs automatically gain dots. Existing owned items surface on the first visit after this feature ships; players can clear those together.

The free daily shop pack grants exactly 50 Clout. GET `/api/player/shop/daily-clout` reports availability, next UTC midnight, and remaining daily challenge entries. POST `/api/player/shop/daily-clout/claim` takes no client amount/date. A profile row lock and unique `shop:daily-clout:YYYY-MM-DD` receipt atomically prevent duplicate credits. It uses the existing claim ledger; no migration is required. The shop shows the reset time in the player's local time zone. Failed/uncertain claims can be retried safely.

Notifications poll the shared caches while the game is open; rewards never depend on a browser timer. Claim success updates the shared status and refreshes bootstrap balances. Reduced motion needs no special handling because indicators are static.

Validation:
- `pnpm run test:campaign:db daily-clout`: concurrent claims, balance deltas, next-day reset, missing player.
- `node artifacts/squabblemon/e2e/verify-notifications.mjs`: four viewport widths, per-player persistent reads, sticky gifts/rewards, Escape dismissal, daily claim state, next-day attempt notices.
- Full safehouse browser check: room/nav marks render and the inbox opens the mail dialog directly.
- Client/API typechecks and production build passed in an isolated copy of the staged changes; concurrent shop/avatar work was excluded.

- `TEST_BASE_URL=http://127.0.0.1:4273 node artifacts/squabblemon/e2e/verify-notification-navigation.mjs`: real collection, cosmetic, mail, store, and bounty components at desktop/phone sizes; exact navigation, tab overrides, obvious outline, click/scroll-away receipts, quick-exit protection, finish preview, reload persistence, and unseen mission retention.
