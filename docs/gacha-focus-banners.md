# Focus pull banners

Recruit keeps the original Fade Recruitment bill over the live punching-bag gym as its permanent first poster. Inmates, Oz, Wonderland, and Red & Blue use illustrated fight posters matching the original bill dimensions over the live gym. Arrows attach to the bill edges. Focus pull controls remain inside the poster with larger ticket images. Only the concise rate description floats below, without a panel or border. Starting a pull hides focus artwork and returns to the existing three-hit bag and reward reveal. Side arrows cycle through active banners, including wraparound. Each poster has a stylized fight title, original roster portraits, offset sheets, and borderless controls. The existing paper shop navigation is preserved; banner selection uses only side arrows. The standard banner remains permanent. The four launch banners run from October 3, 2026 at 00:00 UTC through October 17, 2026 at 00:00 UTC (end exclusive).

Edit `lib/squabblemon-engine/src/pullBanners.ts` to schedule a banner, choose its featured roster, and set its three showcase portraits. Both the client and server consume this definition. Keep banner IDs stable; bump the banner odds-version suffix in the transaction when changing its weighting rule.

Rarity rolls, ticket/Clout prices, first-two-slot new-card protection, within-pack repeat protection, shared cosmetic pity, duplicate payouts, and the ten-pull Rare+ guarantee remain unchanged. Once an eligible rarity pool is formed, featured cards have integer weight 3 and other cards weight 2. This is 1.5× relative selection weight, not a guaranteed featured card or a 50 percentage point increase. The Rare+ replacement uses the same featured weights. Story-only cards retain their existing unlocks.

Launch focus counts: Inmates 6, Oz 7, Wonderland 5, Red & Blue 17. The Rates dialog lists every featured card. The purchase request persists the banner ID for retries, and the receipt records it in `oddsVersion` for history/reload recovery. The server rejects unknown, upcoming, and expired banners before charging; existing receipts can still be recovered after expiry.

Validation:
- Focused economy, database transaction, and banner tests: 23 passed, no skips.
- Request journal tests: 6 passed.
- Frontend/API TypeScript checks and API code generation passed.
- Production build and entry-bundle budgets passed.
- Browser checks at 1440×900, 390×844, and 320×700 cover all five selections, loaded portraits, horizontal overflow, roster disclosures, interrupted responses, reload recovery, and one-charge retries.
- Broad API run: 260 passed, 4 failed, 2 skipped. Failures were a Dr. Fade training-fund expectation, an event-feedback PGlite async error, and two patch tests requiring the native PostgreSQL runner. These are outside the changed banner paths.

Backgrounds were generated with the built-in image-generation tool and encoded as WebP (1536×1024, quality 88). The five runtime assets total about 2 MB; adjacent banners preload for arrow navigation. Exact prompts are in `docs/banner-art-prompts.md`.
