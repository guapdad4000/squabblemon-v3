# OpenArt finishers: installed provisionally

All 100 completed non-fairytale character renders are assigned as game defaults at the user's request: “implement them all and we will swap out over time.” They join the 103 existing clips. Known visual defects remain in these source renders; installation does not mean clean visual or subjective audio acceptance.

`openart-specials.json` records each character, engine ID, stable clip ID, source generation, SHA-256, native dimensions, measured duration, and replacement notes. Its `sha256` is the installed runtime file digest; transformed user-supplied media also records the original `sourceSha256` and exact ZIP entry under `suppliedArchive`. Replaced Janitor CDN provenance remains intact under `previousSource`. Detailed sampled-frame findings remain in `../../deliverables/openart-specials/review/visual-findings.json`.

- Runtime files: `../public/assets/special-moves/oa-<catalog-id>-v1.mp4`.
- Defaults and timing: `../src/specialMoves.json`. Explicit assignments take precedence over procedural fallbacks.
- Playback uses the complete delivered video at normal speed (5.167 or 8 seconds), with the existing cyan key, audio preference, reduced-motion fallback, and per-fighter once-per-match gate.
- Demario uses generation `Gzt40FX7fhe6HBiIqnd5`, the tool-based **Special Delivery** retry. His ability display name matches. Gameplay effects and token identities are unchanged.
- Eight deferred fairytale characters, six unanimated support cards and ten Blockbusters retain their existing procedural effects. Existing browser-specific animation overrides still take precedence.

## Swap one render

1. Use the manifest's generation ID and notes to identify the exact version being replaced. Keep prior generation details in the review history.
2. Replace that runtime MP4, preserving the stable clip ID and assignment so saved workshop selections keep working. Preserve the character's identity, full frame and delivered aspect ratio. Future prompts must follow the current rules, including no required golden fist.
3. Measure the replacement with `ffprobe`; update the catalog's playback window and set its `revision` to the first 16 characters of the new file's SHA-256. Update the manifest's source, hash, dimensions, duration and review notes. The revision makes browsers fetch the replacement instead of a cached clip.
4. Review keyed motion, readable title and audio in the workshop and in a battle. A frame or metadata check alone is not creative acceptance. Avoid global chroma-key changes to hide defects in one source.
5. From the repository root, run `pnpm --filter @workspace/squabblemon test:special-moves`. With the app running, `pnpm --filter @workspace/squabblemon exec node e2e/verify-openart-runtime.mjs` verifies runtime assignments, native media timing, renderers, audio controls, fallbacks and representative battle wiring. Set `SPECIALS_BASE_URL` when using a port other than 4211.

Before release, rebuild shared types with `pnpm run typecheck:libs`, then run the app type check and production build. Restart a running Vite preview after rebasing if it still shows old ability names; confirm the printed move and selected animation match the source before recording browser results.

The workshop is available at `/moves`, or `/e2e/special-moves.fixture.html?card=drfade` on the development server. Its per-browser selections are useful for previewing swaps; ship catalog changes to change defaults for all players. The side-by-side review at `/e2e/openart-specials.fixture.html` loads installed clips from runtime assets, so a fresh checkout does not need the ignored local raw-video copies.
