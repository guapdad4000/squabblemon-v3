# Special move animation system

## Wifey replacement — September 17

The new `D:/minimax/special_moves_chroma/char20_chroma.mp4` replaces Wifey's previous
clip byte-for-byte with a fresh content revision. The catalog now uses her printed
move name, Side Eye. Playback starts at 0 with a 6500ms hold at normal speed to retain
the bag swing, sunflower burst, WIFEY title, and finishing pose. Native audio follows
the existing sound controls. The card's ability, rarity, and artwork are unchanged.

## GUAP — September 17

GUAP adds the 66th playable card and uses char91 FINNAM!, bringing the imported video
library to 91 clips. His Mythical card retains the user's original transparent sprite
and golden aura. The video starts at 0 with a 6500ms hold at normal speed to show the
full falcon reveal and title; its dark cinematic background remains visible during
the burst. Native audio, mute, reduced motion, skip, and manual overrides use the
shared system. See `guap/README.md` for card stats, provenance, and artwork invariants.


## Wave 5 — September 17

Wave 5 brought the library to 90 delivered videos. All 65 playable cards then had enabled
default special-move assignments. Wave 5 fills the final 20 expansion gaps:

| Engine card | Clip | In-game move | Video agent's delivery name |
| --- | --- | --- | --- |
| bodegacat | char71 | Counter Claim | Bodega Run |
| crossingguard | char72 | Safe Crossing | Halt |
| laundry | char73 | Fresh Cycle | Spin Cycle |
| busker | char74 | Loose Change | Open Mic |
| cornercoach | char75 | Run It Back | Play Call |
| nightcashier | char76 | Late Shift | Scan & Bag |
| dogwalker | char77 | Walk the Pack | Good Boy |
| mural | char78 | Fresh Color | Fresh Coat |
| chessregular | char79 | Quiet Fork | Knight Move |
| gardener | char80 | Neighborhood Roots | Harvest |
| piratedj | char81 | Citywide Signal | Pirate Signal |
| dancecaptain | char82 | Whole Block Moving | Cipher Lock |
| nightmedic | char83 | All Clear | Code Save |
| subwaymagician | char84 | Now You See Me | Card Trick |
| ogdominican | char85 | Block Shortcut | ¡Doble! |
| conductor | char86 | Last Stop | Ghost Train |
| midnightmayor | char87 | Keys to the City | Civic Decree |
| bigzoey | char88 | Hold the Block | Big Zoey |
| leroy | char89 | Golden Glow | Dragon Palm |
| partytitan | char90 | Everybody Outside | Block Party |

The expansion keeps its authoritative 10 Common / 5 Rare / 5 Mythical split, printed
ability names, and gameplay effects. Handoff names and tiers are delivery metadata.
Each new clip is 6.584 seconds with native audio; battle excerpts use the existing
0.8-second start and 3.6-second hold at normal speed. Workshop previews play the
complete clip. Content revisions prevent stale cached media; manual overrides and
disables still take precedence. Rastamon and Snow Bunny retain their corrected clips.

## Wave 4 — September 17

Wave 4 brought the library to 70 videos and covered all 45 playable cards at that time. The seven Super Common additions map as follows:

| Engine card | Clip | In-game move | Video agent's delivery name |
| --- | --- | --- | --- |
| shiesty | char64 | Mean Mug | Ghost Mode |
| torta | char65 | Hold It Down | Hot & Fresh |
| waterboy | char66 | Cold Water | Hydration Pack |
| buspass | char67 | All-Day Transfer | Express Lane |
| cognac | char68 | Liquid Courage | On the Rocks |
| bustdown | char69 | Wrist Check | Ice'd Out |
| soulfood | char70 | Full Plate | Sunday Service |

The game retains its printed moves, ability behavior, and Super Common rarity for
all seven. Delivery names and rarity labels are source metadata, not balance changes.
These clips use the usual 0.8s start, 3.6s battle hold, normal speed, and native audio.
Workshop previews play the complete video. Existing manual replacements and disables
continue to take precedence over defaults.

## Wave 3 — September 17

Wave 3 brought the imported total to 63 H3 videos and covered all 38 cards in the
pre-Super-Common roster. The nine former gaps map as follows:

| Engine card | Clip | Move |
| --- | --- | --- |
| nguyen | char55 | Side Project |
| manman | char56 | All Hands |
| pinaynurse | char57 | Check In |
| honestthot | char58 | Real Talk |
| earthy | char59 | Grounded |
| abuela | char60 | Eat Something |
| icecream | char61 | Treat the Block |
| scammer | char62 | Imposter |
| vibe | char63 | Wave Check |

These use the ordinary 0.8s start, 3.6s battle hold, and normal playback speed.
Workshop previews play the full video. Native audio follows the existing sound
controls. Browser overrides remain available, including disabling a video.
The video agent's rarity labels describe its delivery and do not change the game's
authoritative rarity assignments. The ten older requested art refreshes already
have assigned H3 videos; replacing those is separate from missing-video coverage.

Seven Super Common cards were added concurrently. Their initial procedural-only
defaults have since been replaced by the Wave 4 assignments above.

## H3 roster refresh — September 16

All 54 H3 MP4s from `D:/minimax/special_moves_chroma` are imported with content revisions.
Clips 47–54 replace provisional mappings for Roaster, Nerd, Plug and Streamer and add
Young Bull, Transplant, Tayaty and Edgar. Unmatched current cards keep their fallback.
The importer rejects unregistered character IDs instead of silently skipping new files.

The workshop previews full clips from the beginning at normal speed, with **Play with
sound** to enable their native audio. Battle videos follow the existing Sound/Muted
control immediately. Browsers that block audible playback retry muted. Hidden tabs,
skipping, unmount, and reduced motion stop playback. Ordinary battle excerpts start at
0.8s and use a 3.6s hold at normal speed; OG Uncle starts at 0 and has a 6.5s hold
(plus the windup), allowing the complete 6.58s newspaper reveal and voice line to finish.
The active battle presentation loop now observes these per-clip hold times.

## Refresh an existing batch

Run `node scripts/import-special-moves.cjs D:/minimax/special_moves_chroma` from the
repository root. The importer matches stable character IDs, keeps missing clips and
card assignments, and stamps each clip with a content revision. Playback and original
video links include that revision so browsers fetch updated bytes. The September 9
refresh imported 34 replacements and retained 12 existing clips. The current roster
has 66 explicit video assignments. Procedural effects remain available as fallbacks.

Run `node scripts/audit-special-move-media.cjs` with the dev server on 4179 to check
decoding, seeking, dimensions, and excerpt length for all catalog videos.

Open `/moves` under the app's base URL to review clips and assign them to cards.
The workshop is also available on the dev server at `e2e/special-moves.fixture.html` without authentication.

All 91 supplied MP4 files are copied into `public/assets/special-moves/`.
`src/specialMoves.json` is the shared catalog: `clips` contains reusable media definitions,
and `assignments` maps engine card IDs to clip IDs. A null assignment uses the existing
card animation. Every current card has an explicit assignment or fallback; future
cards automatically fall back. The initial character matches are provisional, based
on the generation catalog in the source folder. The original videos remain untouched.

## Replace a bad animation

1. Select the card and another clip in the workshop, then click **Use for this card**.
   This saves an override in this browser for subsequent battle events. Choose
   **Card effect only** to disable its video. **Restore defaults** clears all browser overrides.
2. For shared defaults, export assignments and replace the `assignments` object in
   `src/specialMoves.json` with the exported object. Browser overrides take precedence,
   so restore defaults when checking changes to the shared catalog.
3. To add new media, place it in `public/assets/special-moves/` and add a `clips` entry.
   Change `file` to replace media without touching card or engine logic. Set `enabled`
   to false to disable a clip globally. `chroma` accepts `cyan`, `green`, or `none`.
   Tune `startSeconds`, `playbackRate`, and `durationMs` for the battle excerpt.

Videos decorate successful ability events for either side. Existing target beams,
status changes, power deltas and portraits remain available underneath. Each clip is
decoded only while mounted and keyed at up to 288 pixels wide / 24 frames per second.
Playback never controls game state. Unavailable media, blocked autoplay and reduced
motion retain existing feedback. Unmount/skip cancels rendering and unloads the video.
Both match presentation paths use a bounded catalog duration, preserving fast-forward
and reduced-motion timing. Replay mounts a fresh clip.

AI-generated backgrounds and character details still need visual review. Chroma removal
cannot recover a character region painted the same cyan as its backing or remove a
generated non-cyan scene. Such clips can be disabled or replaced in the workshop.

Validation: `node --import tsx --test src/specialMoves.test.ts` from the app folder;
`node scripts/check-special-moves.cjs` from the repository with the dev server on 4179.
`node scripts/check-wave3-moves.cjs` verifies all nine Wave 3 workshop and battle
videos on desktop and phone, including sound, chroma, impact, and cleanup.
Pass `--wave4` to run the same checks for all seven Wave 4 cards, including support items.
