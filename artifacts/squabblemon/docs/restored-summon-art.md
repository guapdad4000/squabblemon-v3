# Recovered summon and ability artwork

Restored October 20, 2026. Source files were recovered from the existing September 26 art deliverables, not regenerated. The original deliverables were outside tracked game assets. Current battle rendering had substituted the summoner's portrait.

| Runtime artwork | Original in `artifacts/deliverables/full-balance-review-2026-09-26/` | Import |
| --- | --- | --- |
| Buddy Bud | `anime-summons-v4/buddy-bud.png` | 1254×1254 lossless WebP; revision `09b1b640e20c4dc1` |
| Royal Guard / Card Guard | `grounded-art-v2/masters/card-guard.png` | 1024×1536 lossless WebP; revision `c87aecb02eb36e89e` |

The conversion checked dimensions, every alpha value, and every visible RGB pixel against the source PNG. No cropping, stretching, background replacement, or regenerated illustration was applied. Revision hashes are the first 16 characters of SHA-256 for the imported file.

`getCardArtworkId` resolves summon identity before historical borrowed artwork IDs, including persisted and reconnected PvP instances. Card views, inspection, attack captions and winning-gang portraits use the restored mapping. Buddy and the Queen keep their own art. Gameplay, ownership, and summon rules are unchanged.

Contraband (`assets/items/contraband.webp`) and Abuela's Packed Lunch (`assets/items/packed-lunch.webp`) were already present in the September 28 item-art import. Their active district cues were clipped into 12–16px rows and omitted from the district details. District details now expose the original art at 80×112 CSS pixels, with the authoritative current owner and effect, in both location and formation views. The board's small cue preserves the art's aspect ratio within its available height. This display supports all current item-mark artwork, not only these two items.

Verification commands from `artifacts/squabblemon`:

```bash
node --import ../../scripts/battle-test-css.mjs --import tsx src/components/summonArtwork.test.tsx
node --import ../../scripts/battle-test-css.mjs --import tsx src/characterAssets.test.ts
node --import ../../scripts/battle-test-css.mjs --import tsx src/components/Battle.test.tsx
node e2e/verify-restored-art.mjs
pnpm run typecheck
```

Browser fixtures create summons and item marks through real local engine actions. They do not access a production account or mutate online matches. Phone, tablet, and desktop viewport emulation is not physical-device testing.
