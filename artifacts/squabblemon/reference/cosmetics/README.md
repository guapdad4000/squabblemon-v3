# Character banners, stickers and deck covers

Imported from the ten user-supplied Squabblemon ZIP packs on September 24, 2026:

- `Squabblemon-Stickers-Covers-1A.zip` through `3C.zip`
- `Squabblemon-V3-Banners.zip`

The packs contain **60 banners, 60 deck covers and 239 stickers**, covering 60 collectible characters. Powerhouse has action, reaction and emblem stickers; its source pack does not contain a portrait sticker. GUAP has portrait, action, FINNAM! and falcon stickers.

The original ZIPs remain the source masters. Runtime copies live in `public/assets/cosmetics/<card-id>/*-v3.webp`: banners are up to 1600px wide, deck covers 768px, and stickers 512px with their alpha channel preserved. The 359 runtime images total 70,629,744 bytes versus 936,610,979 bytes of original PNGs. No artwork was regenerated or cropped.

`import-manifest.json` records the source ZIPs and their SHA-256 hashes, every source member and image hash, and the matching runtime path, dimensions and byte size. The shared engine's `characterStyleArtwork.ts` maps those assets to the existing catalog IDs.

## Where the artwork appears

- `/game/style`: searchable character collections, including Super Rares.
- `/game/style/:cardId`: the complete sticker pack, supplied banner, and deck-cover preview.
- Profile, inventory and character reveals: the supplied banner and equipped stickers.
- Deck boxes: the supplied deck cover for the deck's cover character, in both static and WebGL rendering.

Existing purchases, sticker IDs, atlas art and card scenes remain valid. Owners of an existing sticker pack also receive its new designs. New individual-image sticker IDs use `<card-id>:v3-<design>` and share the existing per-character pack unlock. Packs show their actual sticker count. The old STOCKZ collection remains available, bringing the library to 61 collections.

## Reimport

From the repository root, after `pnpm install --frozen-lockfile`:

```sh
pnpm --filter @workspace/squabblemon exec node ../../scripts/import-character-cosmetics.mjs /absolute/path/to/packs
```

The importer reads image entries only, rejects duplicate or invalid paths, converts the images and regenerates both manifests. Python 3 and the app's existing Sharp dependency are required.

## Verification

```sh
pnpm run typecheck
pnpm --filter @workspace/squabblemon exec tsx --test src/cosmeticAssets.test.ts
pnpm --filter @workspace/api-server exec tsx --test src/lib/cosmetics.test.ts
```

For browser checks, start the existing local preview with `VITE_E2E_AUTH=true`, then run `node --import tsx e2e/verify-character-cosmetics.mjs` from `artifacts/squabblemon`. Set `UI_ORIGIN` to the local preview origin and optionally `BROWSER_EXECUTABLE` to an installed Chromium/Chrome binary. The smoke test uses a disposable browser context and mocked bootstrap; it does not call live purchase or equip endpoints. Screenshots and the report are written under the app's ignored `screenshots/character-cosmetics/` directory. Database persistence tests require the existing isolated database runner.
