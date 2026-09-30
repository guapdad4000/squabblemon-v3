# Side and Wiz special-move handoff

The September 30, 2026 upload contained 14 five-second, portrait H.264/AAC renders. The characters were matched against their existing card and story portraits. The runtime files in `public/assets/special-moves/` are web-optimized H.264 encodes (CRF 22, High profile, 768 × 1344, 124 frames) with the supplied AAC audio copied unchanged and fast-start MP4 metadata. The original uploads remain in `attached_assets/`. Runtime SHA-256 prefixes are the catalog revisions.

| Uploaded clip number | Character | Runtime clip |
| --- | --- | --- |
| 01 | OG Blue | `oa-blue-side-1-v1` |
| 02 | Blue loco | `oa-blue-side-4-v1` |
| 03 | Red Plaid Petey | `oa-red-side-1-v1` |
| 04 | Flying Monkeys | `oa-flying-monkeys-v1` |
| 05 | Blue Scarf crashout | `oa-blue-side-3-v1` |
| 06 | Red Robber | `oa-red-side-3-v1` |
| 07 | Blue Big Trippin | `oa-blue-side-5-v1` |
| 08 | Ruby Shades | `oa-red-side-5-v1` |
| 09 | Ganger Blue (story-only) | `oa-ganger-blue-v1` |
| 10 | Wicked Witch | `oa-wicked-witch-v1` |
| 11 | OG Red Night | `oa-red-side-2-v1` |
| 12 | Ganger Red (story-only) | `oa-ganger-red-v1` |
| 13 | lil Blue | `oa-blue-side-2-v1` |
| 14 | Red Robber alternate | Not imported |

Clips 06 and 14 show the same Red Robber and the same *Reach Out* title. Clip 06 has a clearer full-character entrance and was selected; 14 is not installed a second time. No Red Hexer (`redside4`) render was supplied, so that playable card keeps its procedural special effect. Ganger Blue and Ganger Red were initially story-only NPCs; after becoming playable story-reward cards, their existing clips were assigned to their corresponding battle abilities. No Snitch or Cracked Head video was supplied; those cards keep the procedural special effect.

## Updated renders

A subsequent four-video handoff replaces the original imported MP4s for Wicked Witch, OG Blue, OG Red Night, and Flying Monkeys. The new upload order was: 1 Wicked Witch, 2 OG Blue, 3 OG Red Night, 4 Flying Monkeys. The stable clip IDs, filenames, assignments, and normal-speed playback windows are unchanged. Each replacement was web-optimized with the same settings above; `specialMoves.json` contains the new SHA-256-based revisions. The originals remain in `attached_assets/`.