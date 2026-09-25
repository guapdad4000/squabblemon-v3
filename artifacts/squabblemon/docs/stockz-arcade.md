# Stockz: Clout Exchange arcade refresh

Entry: `/game/challenges` > Play Stockz. The existing cabinet, Stockz collectible portrait, game routes, shared Radix dialog, authentication and server economy are retained. No dependencies added.

## Presentation

Clean Japanese candy-cabinet direction: cream/chrome framing, midnight monitor, mint highlights, royal-blue selectors and coral action buttons. Stockz becomes the host using `getCardImage('stockz')`, not a replacement character.

The setup is a three-step control deck: illustrated company, up/down call, Clout stake. A locked-order monitor shows the real closing countdown and saved-trade status. Only a complete server receipt reveals the result. Wins get a finite coin burst and net-profit headline; misses receive a calm, factual receipt without near-miss effects. Gross returned Clout and stake are shown separately. Historical receipts are reviewable without replaying the celebration.

The preview trace is explicitly decorative. It is not price history, trading advice or a signal. There are no client-generated payouts, altered probabilities, autoplay, escalating stakes or invented win streaks. The existing 50/50 outcome, five-trade daily cap and server settlement remain unchanged.

## Art

`public/assets/fadecade/stockz/arcade-icons.svg` contains six original, editable 128-unit symbols in a transparent 3-by-2 contact sheet. Reuse `#durg`, `#snkr`, `#bode`, `#clout`, `#bell`, `#burst` with SVG use elements. They depict a satin durag, sneaker, bodega, Clout coins, closing bell and reward burst. Colors are normal material colors with clean cel shading, not a uniform gold/grunge wash. No external font or brand logos are required.

The existing `assets/characters/stockz.webp` and `assets/fadecade/stockz-screen.webp` are not replaced.

## Controller contracts

- Keep existing `/api/player/stockz`, `/start`, `/settle` endpoints and payload shapes.
- A synchronous gate prevents same-frame duplicate submits. Uncertain retries preserve the full ID/ticker/direction/stake payload.
- Cancel abortable stale GETs before mutations. Match recovered orders and settled receipts by server ID.
- A missing payout is pending, not a loss. Zero is a legitimate settled loss. Non-finite or invalid receipt values never produce a reward display.
- Refresh bootstrap currency after confirmed changes. Key the session by player ID so one account cannot inherit another account's pending order.
- Countdown derives from server timestamps and current wall clock; it recovers after a background tab. Invalid timestamps require a market refresh.
- Keep shared dialog keyboard focus management. Respect OS reduced motion and the game's root/portal reduced-motion flags. New controls have visible focus and mobile-sized targets.

## Validation performed

14 isolated Node tests passed for verified receipts, zero/missing payouts, net math, timer bounds/resumption, malformed times, deterministic preview geometry, synchronous submission gating and immutable retry payloads. They are imported from the existing `src/stockz.test.ts`, so the standard frontend test command includes them.

TypeScript transpilation passed for the three production modules; PostCSS parsed the stylesheet and XML parsing validated the six-symbol SVG.

Offline Chromium presentation fixtures passed for 12 states: ready, active, closing bell, win, loss, uncertain retry, daily limit, insufficient balance, loading, offline, invalid countdown and active-order precedence over an old result. Layouts were checked at 320, 375, 430, 768 and 1280 pixels. Both reduced-motion settings were checked. No JavaScript page errors were observed in those fixtures.

These were isolated fixtures, not a full React/controller integration run. The QA renderer used the production presentation component with a JSX-to-HTML shim and a clearly labeled placeholder for the unavailable repository portrait. Full workspace dependencies, the authenticated app, live server calls, full TypeScript typechecking and production bundling could not run in the restricted local environment. They remain required before merge.

## Review commands and smoke checks

```sh
pnpm --filter @workspace/squabblemon typecheck
pnpm --filter @workspace/squabblemon test
pnpm --filter @workspace/squabblemon build
```

On the authenticated preview, open the Fadecade and verify the existing character and cabinet images, all six icon assets, and no errors in the console. Start a minimum-stake trade, double-tap the button, leave/reopen the dialog, background the tab, reveal after close, then review the receipt. Verify one server order and one payout. Repeat with a disconnected request/response and check that retries do not change the submitted order. Check a loss, insufficient Clout, the daily cap, account switching, keyboard-only navigation, mobile scroll and both reduced-motion settings. Do not merge until authenticated integration and CI checks pass.
