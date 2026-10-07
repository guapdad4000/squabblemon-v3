# Challenge sprite animation upgrade

Implemented across Girl Fade, Fade Market, Block Takeover, Waffle Run, the Road, and Stockz. Gameplay, server timing, entry limits, and reward rules remain unchanged.

## Art and asset inventory

The OpenAI built-in image generator created the movement sheets and Stockz banner from the existing character artwork. Exact generation, repair, and transparency prompts are recorded in [generation.json](generation.json). The selected original full-resolution PNG paths refer to the local generator output; the finished WebP assets are checked into the game assets directory.

| Atlas | Grid | Cell size | Movement rows |
| --- | --- | --- | --- |
| `girl-0-front`, `girl-0-back` | 4 × 5 each | 320 × 320 | Bonnet Girl: guard, left jab, right jab, uppercut, duck |
| `girl-1-front`, `girl-1-back` | 4 × 5 each | 320 × 320 | Bottle Girl: guard, left jab, right jab, uppercut, duck |
| `girl-2-front`, `girl-2-back` | 4 × 5 each | 320 × 320 | Baby Momma: guard, left jab, right jab, uppercut, duck |
| `market-crew` | 4 × 6 | 128 × 128 | Rear-view Dr. Fade guard/punch, cashier walk/restock, navy/red YN walk |
| `waffle-pigeon` | 4 × 6 | 128 × 128 | Idle, hop, wing strike, rear idle, syrup spit, hurt |
| `waffle-staff-0` through `waffle-staff-3` | 4 × 1 each | 128 × 128 | Individually generated busboy, cashier, cook, security; two idle frames and two attack frames each |
| `stockz-chibi` | 4 × 4 | 160 × 160 | Trading idle, waiting, win, miss |
| `road-rest` | 4 × 2 | 128 × 192 | Runner idle, defeat |
| `block-crew` | 4 × 3 | 96 × 96 | Dr. Fade, Baby Momma, Bottle Girl map tokens |

**15 atlases, 220 distinct frames, plus one 1800 × 600 Stockz banner. Total runtime artwork: 3,666,074 bytes.** The Road's existing animated walk, fight, and clear sheets remain in use. Static environments, plates, and printed callouts stay scenery.

The broken combined Waffle staff sheet was replaced by four standalone sheets generated and inspected sequentially, one character at a time. Its original prompts are preserved under `superseded` in the manifest. The pigeon was also cleaned independently.

The Girl Fade camera uses the same bounds for idle and action poses. Every arm, glove, and hair silhouette is contained within its atlas cell. Only the outside arena edges and below-waist foreground may crop. Front and rear views are separate generated art, preserving anatomical left/right actions.

Stockz uses his original portrait in the cabinet and matching generated artwork for the trading booth and animated chibi host. His reactions follow saved trade state; the code renders all titles, prices, selections, balances, and receipts.

## Export and playback

[../../scripts/art/export-minigame-motion.mjs](../../scripts/art/export-minigame-motion.mjs) exports the generated transparent art into uniformly registered atlases. It preserves RGBA pixels, separates silhouettes and attached effect pixels, applies one scale per atlas, and packs them with transparent margins. It does not paint characters or remove their backgrounds. Waffle Run uses lossless WebP and nearest-neighbor resizing to preserve its pixel style. Other atlases use WebP quality 92 with full alpha quality.

Run the exporter from the repository root after making the manifest source files available:

```sh
node scripts/art/export-minigame-motion.mjs
```

`MINIGAME_SPRITE_KEYS` can select comma-separated atlas names for individual exports while preserving the other report entries. `SPRITE_SHARP_MODULE` can supply an installed Sharp module path when Sharp is unavailable from the root. [atlas-report.json](atlas-report.json) records each source hash, runtime dimensions, bytes, source silhouette bounds, and exported frame placement.

`motionSpriteCatalog.ts` maps game states to atlas rows. `AnimatedSprite.tsx` uses CSS frame stepping inside a fixed SVG viewport, with one shared intersection observer and document visibility listener. An explicit cell clip prevents neighboring atlas rows from showing in tall or wide sprite containers. No frame clock updates React state. Cabinet previews defer atlas loading until visible; offscreen, hidden-tab, paused, and covered cabinet sprites suspend playback. Settings and OS reduced motion show a representative static frame. Original artwork is retained as a fallback if a new atlas fails to load.

## Verification

Run the local client with E2E auth enabled, then set `ARCADE_BASE_URL` to that server:

```sh
ARCADE_BASE_URL=http://127.0.0.1:4231 pnpm --dir artifacts/squabblemon run test:minigame-motion-browser
ARCADE_BASE_URL=http://127.0.0.1:4231 pnpm --dir artifacts/squabblemon run test:arcade-browser
ARCADE_BASE_URL=http://127.0.0.1:4231 pnpm --dir artifacts/squabblemon run test:waffle-browser
ARCADE_BASE_URL=http://127.0.0.1:4231 pnpm --dir artifacts/squabblemon run test:road-motion-browser
ARCADE_BASE_URL=http://127.0.0.1:4231 pnpm --dir artifacts/squabblemon run test:stockz-motion-browser
```

Set `PLAYWRIGHT_EXECUTABLE_PATH` to a local Chrome executable when using an installed browser. Final verification used `/usr/bin/google-chrome` after isolating a crash in the bundled headless-shell renderer; each new atlas also decoded successfully on its own. The gallery defers offscreen atlas uploads.

The atlas proof decodes all 220 frames and rejects blank bodies, silhouette pixels at cell borders, or repeated static rows. It verifies four distinct playback poses, zero React commits during frame playback, pause, offscreen suspension, both reduced-motion controls, and rendered frame isolation in a tall container.

Real desktop/phone game journeys verify Girl Fade counters, Market restocking/power-ups, Block raids and rewards, Waffle combat/resume/reward claims, Road arrival/defeat, and Stockz saved-error recovery, close/reopen, and one settlement. Stockz also runs at 360 × 640 and checks the illustrated popup frame fits the viewport.

Screenshots and receipts are saved locally under `screenshots/minigame-motion`, `screenshots/arcade-games`, and `screenshots/waffle-run`; the review gallery is `/e2e/minigame-motion.fixture.html`. The gallery loops action rows for inspection; the games play those moves once when triggered. These are review fixtures, not production game entry points.
