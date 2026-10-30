# Parked white streak: regular PvP player-mat split

Saved at the user's request on 2026-10-30. Removed from Kumite matchmaking/search, opponent found, and Enter arena. No Kumite screen loads the idle streak.

## Preserve these assets

- Original animation: `/home/falcon/Downloads/white-crack-streak/white-crack-streak-fast.gif`.
- Optimized lossless-alpha animation: `artifacts/squabblemon/public/assets/kumite/matchmaking/white-crack-streak-v1.webp` (408,440 bytes, 752x416, 73 frames, 2920ms, infinite loop).
- Optimized still: `artifacts/squabblemon/public/assets/kumite/matchmaking/white-crack-streak-still-v1.webp` (5,702 bytes).
- Source/provenance: `output/kumite-matchmaking-animation-20261030/asset-manifest.json`.

The asset is intentionally retained at its existing versioned path so no duplicate file or new asset generation is needed to audition it elsewhere. Keeping a public file does not preload it: Kumite no longer renders any streak element or resource hint.

## Future audition

Consider this as an animated split between the two player mats in regular PvP. Keep it behind cards, card explainers, banners and interactive UI; align it to the real mat boundary at phone, tablet and desktop sizes. Use existing visibility, OS and saved reduced-motion gates, and the still fallback. It should not affect hits, timing, rules or mat sizing.

The user is considering a BLACK ink variant for that boundary. This is a saved idea, not an approved/generated replacement. Do not recolor or generate it as part of the Kumite change. If requested later, preserve true alpha and the approved shape/timing; inspect it on both bright and dark mats before choosing opacity.

No regular PvP code has been changed by this note.
