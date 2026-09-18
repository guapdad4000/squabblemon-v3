# Wave 5 special moves — September 17, 2026

Published to https://squabble.today in deployment [6aac7e5c512808030f262a49](https://app.netlify.com/projects/squabblemon-triple-lane/deploys/6aac7e5c512808030f262a49).

## Changes

- Imported char71–char90 from the delivered D:/minimax/special_moves_chroma files; older media was not reimported.
- Assigned all 20 expansion cards to their matching videos, including OG Dominican (char85), Big Zoey (char88), and Leroy (char89).
- Library: 90 clips. Playable roster: 65 cards, all with enabled default video assignments.
- Preserved the expansion's 10 Common / 5 Rare / 5 Mythical balance, printed abilities, manual overrides, and the corrected Rastamon/Snow Bunny mappings.
- New clips use cyan removal, native audio, normal speed, and the existing 0.8-second start / 3.6-second battle excerpt. Workshop previews play the entire clip.

## Verification

- 18 special-move mapping and presentation timeline checks passed.
- All 20 files fully decoded: 158 video frames and 206 audio frames each, H.264 yuv420p / AAC, approximately 6.58 seconds. Seeking to the battle start succeeded for all 20.
- Sampled backdrop pixels support cyan keying. The supplied contact sheet was visually inspected for the character mapping.
- Production frontend/API/shared type checks, API bundle smoke checks, release build, and entry budget passed (189.8 KiB / 475 KiB).
- All 20 public MP4 responses return 200 and video/mp4, with content hashes matching the tested source bytes. Published HTML and the special-move JavaScript chunk match this release.
- Live health returns 200; anonymous player bootstrap returns 401.
- Interactive browser playback QA could not run: the CUA helper failed before browser startup with a Windows deny-read ACL error, including after reset. This release uses the existing playback component; no browser playback result is claimed.

Audit files: screenshots/wave5-media-metadata.json, screenshots/wave5-decode-audit.json, screenshots/wave5-production-audit.json.

Preview: https://squabble.today/moves?card=leroy
