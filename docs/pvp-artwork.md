# PvP artwork — September 21, 2026

User-supplied artwork, preserved as transparent WebP cutouts. No redraw or white-color removal. Source files were trimmed and resized for UI use.

## Trophy mapping

| Rank | Source PNG suffix | RP floor |
| --- | --- | --- |
| Rookie (jade) | 5106066f-a711-411d-a4db-65e5114f0745 | 0 |
| Bronze | 1b7c1e4e-b4ca-4058-98cd-31ad4a29ef93 | 100 |
| Silver | 87b35e26-0590-4520-8504-5e6eda866126 | 300 |
| Gold | 200ccbb3-c03b-446d-83f5-5ee997d96ce8 | 600 |
| Platinum (diamond-covered gold) | c3b5d790-b650-486f-b71d-b55ed88f36b3 | 1000 |
| Diamond (clear crystal) | 5f0a55d6-a4dd-48c1-80a2-a0630fbd0d77 | 1500 |
| Park Royalty (cosmic) | 67818f28-300d-4208-94b2-307b91735202 | 2200 |

Files originally named `grok-image-<suffix>.png`. Thresholds remain defined by the engine. The jade/Platinum assignment follows the proposed visual mapping, pending any user correction.

- Dr. Fade victory: ab648c17-4f51-4fc8-8741-41586c73886e.
- Dr. Fade defeat/draw: d3ddeb39-63a8-4a50-9ba0-654ac7b893fc (1).
- RP shield: 9270b223-de32-4f25-b819-42e169ee5e95.
- Versus layers: `segments (6).zip`; muscular-arms-2 is screen left and muscular-arms-1 is screen right. Trees, ground, crack and six fighter silhouettes are independent layers. The supplied sky segment had holes where the foreground was removed, so the composition uses a CSS sky gradient behind the supplied cutouts.

## Behavior

Rank display and expandable ladder use the seven trophies. PvP result cards use authoritative server points, district scores, outcome and reason. Promotion is displayed only when RP increases into another tier. Private friend fades retain rematch and board inspection and do not invent RP rewards. Reduced-motion preferences disable entrances and number animation. Versus is skippable; the existing match clock and automatic entry timing are unchanged.

## Verification

`node artifacts/squabblemon/e2e/verify-pvp-art.mjs` checks result variants, point signs, promotions, all trophy image loads, action visibility at 320×568 / 390×844 / 1440×900, reduced motion, and versus entry. Uses the local Vite fixture at port 4197 by default (`UI_ORIGIN` override supported).
