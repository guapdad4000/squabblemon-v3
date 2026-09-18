# Special move art direction and generation handoff

Source: the user supplied their full video-agent conversation on September 16, 2026.
This records accepted creative direction and historical context; it is not a request
to submit more generation jobs, spend credits, or change the external pipeline.

## Accepted creative direction

- Keep characters illustrated, cel-shaded 2D fighting-game fighters throughout.
  The user rejected photorealistic/live-action drift.
- Marvel vs Capcom / Guilty Gear / Street Fighter-style energy, composed vertically.
  The generation brief requested 9:16. Preserve the delivered media's actual aspect
  ratio when displaying it; do not stretch files to force the requested format.
- A readable windup, exaggerated action, strong impact beat, and finisher pose.
  Manga speed/impact lines, afterimages, saturated outlined VFX, squash and stretch.
- From September 17 onward, use much leaner character builds and more dynamic
  poses: lunges, twists, slides, spins and strong asymmetric action silhouettes.
  Preserve the supplied character design and intentional aura.
- Clean cyan #00FFFF backing for compositing. Actual generated scenes may deviate;
  assess usable frames rather than assuming the entire background stays uniform.
- Common cards get clean, punchy moves. Legendary moments can be more theatrical.
- Native synchronized audio is intentional: impact sounds, whooshes, prop sounds,
  and character-specific cues. Honor the game's mute preference.
- OG Uncle's full newspaper reveal, “Y'ALL WASN'T OUTSIDE” headline/voice line,
  sneaker dust, and bass are part of the Legendary concept.

## Completed delivery and integration

September 17 creator deliveries: char92 is Foodz, **What's Crackin'!**, and char93
is Simmy, **Heartbreak**. Both are assigned to their existing game cards. The
delivery aliases "Foodie", "Uncommon", and "Rare" do not change their identities:
Foodz and Simmy remain Mythical, with their existing gameplay effects. Their
printed move names now match the delivered finishers. Both clips start at zero,
play at normal speed, and get a 6500 ms battle window (source duration 6.583 s).
The original card portraits and aura are untouched. Simmy's source contains an
aggressively keyed reference; sampled opening/finishing video frames retained
his dark pants, so the normal cyan key remains enabled. The workshop retains
the disable/swap override if a later review finds unwanted transparency.

The user approved all 54 clips being redone with MiniMax-H3 and per-character audio.
The completed source is `D:/minimax/special_moves_chroma/`; the separate `_v1`
folder contains historical Hailuo versions. The final recovery supersedes earlier
34/54 partial-delivery and credit-exhaustion reports.

Wave 3 adds char55–char63 and Wave 4 adds char64–char70. All 70 live files were copied
byte-for-byte into the game and checked for decoding, seeking, and audio tracks.
All 45 current playable cards have enabled video assignments. The 70 clip IDs include character variants and refreshes,
so they are not a count of distinct playable cards. Procedural effects remain the
fallback for disabled, unavailable, or reduced-motion playback.

Wave 4 supplies Shiesty YN, Torta, Water Boy, Bus Pass, Cognac Bottle, Bust-Down Watch,
and Soul Food in that order. All seven retain the game's Super Common rarity and
printed ability names. The video agent invented different delivery names and rarity
labels; those do not change the game. See the mapping in `special-moves.md`.

The workshop previews whole clips at original speed with opt-in sound. Battles use
configured excerpts, except OG Uncle's full reveal. Future tuning should check that
windup, impact, and the finishing pose remain understandable within each excerpt.
See `special-moves.md` for import, assignment, timing, and audio behavior.

## Historical queues and current integration (September 17)

The earlier, more specific queue description lists seven new common/support
characters for slots 55–61: Nguyen, Man-Man, Pinay Nurse, Honest Thot, Earthy Sugar
Foot, Abuela, and Ice Cream Truck. All seven have local artwork and are playable,
upgradeable, and obtainable through Street Packs. Their dedicated move videos have
now arrived as char55–char61, respectively, and are assigned. They are not awaiting art.

Another eleven requested art refreshes were historically pending: Rastamon, Gamer, Bike
Life, Boss Bae, Officer Oink, Barber Bro, Bottle Girl, Sneaker Reseller, Church
Auntie, Wifey, and Scammer. All eleven have local artwork now. Boss Bae and Scammer
were missing from the playable catalog; both were added using the Network Boost and
Imposter designs in `reference/data.js`. Boss Bae uses char16. Scammer now uses its
new char62 Imposter video, and Cool Vibe YN fills the last gap with char63 Wave Check.
The other nine retain their assigned H3 clips; no newer refresh-specific videos
exist in the supplied folder. The ten remaining refresh requests are optional
replacement work for already assigned videos, rather than missing playable moves.
The final agent message mistakenly attached slots 55–61 to this eleven-character
list; confirm future numbering against the live generation catalog before imports.

All eleven new common cards and all eleven refresh characters are available in the
local preview's collection and deck builder. Normal accounts retain their existing
ownership/acquisition rules. Artwork URLs include content revisions; run
`node scripts/sync-character-revisions.cjs` after replacing portraits.

## Historical pipeline issues

The video agent reported fixing the poller's model selection and mishandling of
successful `code: 0` responses. It also reported that `submit_all.py` still needed
to persist the model in new registry entries. No external generation scripts were
changed during game integration. The lost first-pass task IDs were replaced by new
completed tasks; historical billing statements in the transcript are not verified.
