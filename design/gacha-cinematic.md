# Gacha cinematic — local QA pass, 24 October 2026

The final direction keeps the street gym and makes a paid opening one connected event: three accepted strikes, three full-viewport punch cels around a fast real mesh launch, a selected rarity-colored video from the bag-mounted POV, the shared crash/pullback film, and the awarded card appearing immediately over the same final wall-hole image. Ten pulls retain their additional foreground burst. Common, Super Common and Uncommon retain clear matte frames independently of the foil preference. Card inspection owns its native top-layer dialog so nested reward screens cannot clip it.

The supplied reference is https://youtube.com/shorts/31sPb3fRKXk. Its visible launch, bright impact and dominant card framing informed the sequence; no video frames or game artwork were copied. The actual local K10 Leroy/Sho’nuff fight supplied compression/contact/release/stands-impact timing; the existing Fade Park art supplied the black-lightning language. This is a new Squabblemon implementation, not a reproduction of another game.

## Generated artwork

Built-in image_gen originally produced four assets in `artifacts/squabblemon/public/brand/gacha/cinematic-v2/`: `contact.webp`, `single-arrival.webp`, `ten-burst.webp`, and the alpha-preserving `burst-foreground.webp`. The historical prompt set, provenance and conversion are recorded in `design/media/gacha-2026-10-24/cinematic-v2-generation.json`. Superseded single-arrival and ten-burst drafts are archived outside public; only the active contact, wall-hole arrival and burst foreground ship. The illustrations contain no card contents or reward values. No crowns were requested or introduced in these new assets.

The follow-up `rarity-flight-v1/` adds seven original optimized assets: flat right wall, alpha isolated bag render, new default gym, corrected base-mounted flight POV, compression, release and wall-impact. Existing `cinematic-v2/contact.webp` supplies the second punch cel. The old side-view `wall-impact.webp` is archived outside public and is no longer requested or rendered; the POV now cuts directly to the supplied smoke film. The initial rounded-barrel flight angle was rejected; final POV uses the flat stitched end-cap at the bottom edge. Generated masters and a video-ready ZIP live in `/home/falcon/Documents/New project 9/output/gacha-rarity-flight/`. New generation metadata records source filenames and prompt summaries. No video was generated in this pass.

The current movie assets are in `artifacts/squabblemon/public/brand/gacha/video-flight-v1/`. They are trimmed exclusively from the six videos supplied by the user; the originals are untouched. Six silent 1600×900 H.264 POV clips are exactly 42 frames / 1.4 seconds each. Super Common/Common use neutral; Uncommon green, Rare blue, Epic purple, Legendary yellow and Mythical red. All 252 POV frames were inspected: the bag remains attached to the bottom foreground; the detached-ball sections and the shared movie's head-on circle shot are excluded. Yellow and green use tighter source windows and mild retiming to preserve that framing. The shared landing contains 80 frames / 2.667 seconds of crash and pullback, with a baked final 150 ms blend to `cinematic-v2/single-arrival-wall-v2.webp`.

Only the selected POV and shared landing are requested while the paid opening is armed. The selected video pair is 2.93–3.80 MB after the delivery optimization; faststart headers, silent tracks, short GOPs and shared browser caching keep these bounded. Posters preserve the same selected scene if video is late, unsupported or fails. Source frame windows, speed ratios, hashes, output sizes and poster provenance are in `design/media/gacha-2026-10-24/video-flight-v1-manifest.json`; inspection sheets and export scripts are in `/home/falcon/Documents/New project 9/output/gacha-video-flight-v1/`. Reduced/static opens do not mount or request videos. Actual awarded cards still use the existing bounded portrait decode queue.

The gym's dropped/key/rim lights stay neutral warm white for every rarity. Rarity no longer colors the scene lights, bag emission or parent haze. Rarity is communicated by the flight footage and actual awarded card. All pull counts share the same final wall-hole plate; ten retains its extra burst foreground without changing that scene.

## Sequence and safety

Shop fixes the cinematic at authored 1× speed, independently of the PvE battle-speed preference. Rarity and presentation speed freeze per opening, and the scene and UI share this timing contract:

| Beat | Visible time after knockout |
| --- | --- |
| Compression | 0–90 ms |
| Gold contact | 90–230 ms |
| Release | 230–350 ms |
| Visible real-mesh launch | 350–1,250 ms |
| Selected rarity POV video | 1,250–2,650 ms |
| Smoke and full wall pullback video | 2,650–5,317 ms |
| Settled arena | From 5,317 ms |
| Awarded-card reveal | 5,317 ms for every pull size; no post-film hold |

The 900 ms launch exposes the actual moving Three.js bag and released chains through a transparent overlay. Seventy-five percent of rarity-specific travel occurs during this visible 3D interval. Its initial impulse is immediate instead of easing in; modest deceleration and continuous velocity carry the bag into the POV cut. Camera follow is reduced from 32% to 20%, letting the bag recede more decisively. The following 1,400 ms POV uses only the curated bottom-attached bag footage. The POV cuts directly to smoke with no side-view bag-crash picture over it. The shared smoke/pullback still plays at its natural duration. The underlying mesh ends its travel at 2,650 ms; its old 450 ms recoil and 1,350 ms debris envelope remain finite, independently of the longer film hold. Seven actual receipt rarities control progressively longer travel; all-SuperCommon receipts correctly remain SuperCommon.

The same mounted gym iframe fills the viewport from confirmed paid `punching`/`tenPunching` through `knockout`/`tenKnockout` and the covered `reveal`/`summary` phases. Header and navigation disappear while strike and skip controls remain available. Resizing before the third accepted strike avoids a fullscreen layout/render stall at the first impact cel. Leaving the sequence restores the ordinary Shop layout without remounting the iframe.

The actual rendered card appears immediately at full opacity and near full size. A small alternating slide/turn settles within 300 ms; its caption is immediately visible. The entrance has no added burst layers, deep flight, impact hold or haul stagger. Controls remain available throughout; reduced motion removes the brief turn. Reduced motion uses a 220 ms static finale when that standalone presentation is invoked; Shop exposes the saved haul directly when reduced motion or unavailable scene readiness bypasses the animation. Hidden tabs pause the finale, and unmount cancels it. Portrait release framing follows the launched bag at 30% rather than cropping it out. The video POV also uses a 30% horizontal crop on tall screens, preserving the left colored energy plume and attached cap without shrinking or stretching the artwork; landing and reveal stay at matching 50% framing. The generated foreground has a narrow edge mask so its transient depth travel never reveals a rectangular image boundary.

Shop still owns the API request, idempotency key, saved receipt, reward order, guarantee and completion. Rewards are saved before any visual sequence. Lost/reloading/static scene readiness exposes the saved haul instead of trapping the player. Image/video decoding never delays receipt persistence or forces another purchase. The visible-time timeline alone advances the reveal; media `ended` never does. A late or rebuffered film seeks to the current shot time, expired shots cannot restart, hidden tabs pause, stale play promises cannot corrupt a resumed shot, and unmount/skip pauses and releases each media source. No frame-by-frame React work is used.

The result surface scales to the viewport/count, keeps every awarded item reachable, and provides exact duplicate/resource/monthly receipts. Large cards and ordinary card inspection remain available. The four active stereo MP3 clips total 60,080 bytes: bag impact 420 ms, chain rattle 360 ms, wall-impact texture 320 ms, and `travel-wind-launch-v3` 2,420 ms. Their decoded durations total 3.52 seconds; cues overlap on the shared timeline. Bag impact starts at 90 ms, wind and chain rattle at 230 ms, and wall-impact texture at 2,650 ms. Trims preserve native pitch, use short anti-click fades and leave mix headroom. The versioned `design/media/gacha-2026-10-24/gym-audio-trim-manifest.json` records the active clips, cue timing, source trims and untouched-original hashes; the old 600 ms and 3,020 ms wind versions are archived outside public and explicitly inactive. `output/gacha-rarity-flight/audio/trim-manifest-v1.json` preserves the historical short-audio provenance. The accepted punches and finite contact/release/wall events own their cues; parent button/KO duplicates and synthetic fallbacks were removed. Mute, speed, hidden-page, reset and unmount cleanup remain enforced. The old mute control, redundant instruction panels and repeated slogans are removed; global sound preferences remain authoritative.

## Verification

Local reports and captures live under:

- `/home/falcon/Documents/New project 9/output/v2-gacha-cinematic/final/`: complete Shop one/ten/phone/scene-loss flow; receipt counts, refresh recovery, image decode and no page errors.
- `/home/falcon/Documents/New project 9/output/v2-qa6/pack-finale-cinematic/`: actual WebGL flight, full-viewport plates, visibility cleanup, slow-art fallback and masked impact captures.
- `/home/falcon/Documents/New project 9/output/v2-card-details/`: seven-rarity foil on/off frames, nested responsive inspectors, focus and gameplay gestures.
- `/home/falcon/Documents/New project 9/output/v2-first-wave/gacha-refinement/`: responsive result/reveal evidence.

The prior pass completed frontend typecheck,25 focused source tests and production build/bundle/style guards. Follow-up validation is recorded below. The final cinematic reveal passed five viewport sizes and 60-card reachability; a keyed-sibling issue on Next card was corrected and guarded by exactly-one-card assertions. Flexible-purchase browser checks passed on 390px and 1440px: 7-ticket / 4-pack Clout batches, interrupted-response idempotent retry, exact 42/60 reward counts, seasonal bonuses, speed/reduced-volume and shared mute preferences. The pre-existing large Story chunk warning remains. Browser evidence uses local fixtures and software WebGL; it is not production multiplayer, physical-device frame-rate or payment-provider proof. The first plain reveal draft and small impact were rejected by the user; final cinematic captures are explicitly separated from those earlier drafts.

## Historical QA7 rarity-flight validation

Before the current pacing/fullscreen revision, 34 focused source tests, frontend TypeScript and the final production build/bundle/style guards passed. The actual integrated Shop flow passed4/4 at desktop/phone including a ten-haul and lost-scene fallback. The finale passed7 cases plus targeted speed/reduced-media/render-stop refinements. Static new venue passed5 viewport/error cases. Full reports and PNG/SFX masters are in `/home/falcon/Documents/New project 9/output/gacha-rarity-flight/`; beat-level captures are in `output/v2-qa7/pack-finale/`. Rendering stops after the final scene frame and restarts once on reset; verified locally. Browser audio checks establish source/timing/lifecycle, not physical speaker sound quality.

## Historical pacing revision — local validation

Before the supplied-video revision, fixed Shop 1× speed, the longer wind cue, 2.5D POV and fullscreen paid-punch layout superseded the original QA7 pacing. A CSS/DOM geometry check passed all four active phases at 1440×1000, 390×844, 320×568 and 844×390 with stationary and translated route ancestors: viewport-sized stage/arena/iframe, unchanged iframe identity, hidden header/tabs, reachable strike/skip controls and idle-layout restoration. Evidence is in `/home/falcon/Documents/New project 9/output/v2-gym-cinematic/fullscreen/`; this layout-only check uses an empty iframe and does not prove live renderer pacing.

The artwork portal now mounts inert during the paid punches and activates on the third accepted hit. This moves image/DOM preparation ahead of the brief cels. Inert preparation has no timer, announcement, focus target or Skip control. The saved result dialog opens in the same layout commit that removes the final plate, avoiding an idle-Shop flash.

Prior source validation: 36 focused tests, frontend TypeScript, production build, bundle budgets and CSS invalidation guards pass. The known Story chunk warning remains. Two reduced-motion flexible-pull cases pass with exact retries/counts, seasonal receipts, mute and fixed cinematic audio speed while the saved battle preference stays at 1.5×.

Uninterrupted desktop/phone captures showed actual mesh travel, full-viewport continuity and no paint gap at card handoff. Final prepared-portal normal desktop single, desktop ten and phone cases preserved every observed beat, with live flight 1,495–1,497 ms and POV 1,400–1,404 ms. The six-case sequential Shop run passed five; its scene-loss-flight case encountered an initial 290 ms software-renderer stall that batched away the short contact state. The same case passed all unchanged strict assertions in an isolated fresh run, including one saved receipt, no second request or late transition, and exact refresh recovery. This is not an unconditional frame-delivery guarantee under load. Both results remain recorded in `output/gacha-rarity-flight/long-flight/verification-summary.json`.

The nine-case finale lifecycle suite passed before inert preparation; the narrow new armed-state case then verified transparent/inert preparation beyond the completion deadline, same-node activation by the real third punch, focus and once-only Skip. Natural completion stops the scene renderer; the existing skip/reset path resumes idle rendering beneath the result and is unchanged.

Prior evidence: `/home/falcon/Documents/New project 9/output/gacha-pacing-v2/` (source/build, motion samples, recordings), `output/gacha-rarity-flight/long-flight/prepared-integration/` and `isolated-scene-loss-flight/` (final integrated sequence/recovery), and `output/gacha-rarity-flight/deliberate-finale/` (lifecycle/armed-state). All browser evidence is local fixture/software-WebGL evidence, not a live-account transaction or physical-device performance claim.

## Historical supplied-video revision — local validation

That source revision passed 42 focused cinematic/reward tests, four gym battery checks, frontend TypeScript, production build, bundle budgets and CSS invalidation guards. The existing large Story chunk warning remains. Entry/GameApp/Home JavaScript budgets remain at 211.5/649.3/954.8 KiB respectively; footage is requested conditionally and is not part of the entry bundle.

Final browser checks pass 17 video lifecycle cases, nine maintained finale cases, the follow-up phone crop case, and actual Shop desktop/phone flows. Both Shop runs retain one receipt, three accepted punches and the actual card/haul. Measured desktop launch/POV/crash spans were 1,500 / 1,403.6 / 2,667.4 ms; phone spans were 1,502.3 / 1,402.3 / 2,664.6 ms. The video cases cover decoded frames, selected-only media requests, no reduced-motion video request, pause/resume, buffering clock rejoin, failed/rejected/late playback, stale promise rejection and explicit source release on skip/unmount. Final portrait footage keeps the colored plume visible using the approved crop, and both videos end over the same wall image as the reward UI.

Evidence is in `/home/falcon/Documents/New project 9/output/gacha-video-flight/README.md`, with the distinct media/frame/build/source reports in `output/gacha-video-flight-v1/`. The short `gacha-opening-preview.mp4` is a silent, unchanged-speed trim of the real local Shop recording from 3.00 to 12.35 seconds; the full recordings remain available. Intermediate runs are labeled separately. These are local fixtures and software-WebGL checks, not live transactions or physical-device frame-rate guarantees.

No commit, push or deployment was performed.

## Faster real-bag launch and direct smoke handoff — local validation

The current revision shortens actual visible mesh departure from 1.5 seconds to 0.9 seconds, increases the initial launch impulse, and reduces camera follow to 20%. Colored POV remains 1.4 seconds and the supplied smoke/landing remains 2.667 seconds at 1x. The old side-on wall-impact image is no longer mounted or requested; three opening punch cels remain. The finite wind cue is trimmed to 2.42 seconds at native pitch to end at the earlier smoke transition.

Validation passes 42 focused source tests, four gym battery checks, frontend TypeScript, production build, bundle budgets and CSS invalidation guards. The existing large Story chunk warning remains. Ten bounded browser cases pass: two actual Shop desktop/phone flows, six targeted video lifecycle cases and two maintained ten-pull finale cases. Mesh flight measured 904.8 ms on desktop and 900.2 ms on phone, with advancing renderer frames and physical bag position/scale samples. At landing onset and 140 ms later, only the smoke movie is visible; the removed side-on image is absent. Receipt counts and recovery remain intact.

Evidence and continuous 1x previews through the first card are in `/home/falcon/Documents/New project 9/output/gacha-fast-launch-v2/README.md`. Source/build logs are in its `source/` directory. Browser captures are silent local fixtures using software WebGL; these checks are not live purchases or physical-device performance proof. No commit, push or deployment was performed.

## First delivery pass and quick entry — superseded size baseline

All new media from this design update was audited. The shipped footprint fell from 20,701,530 to 15,769,163 bytes (23.83%): active video encodes are 11.10% smaller, active WebP art/posters 12.10% smaller, and eight unused/duplicate files were archived outside public. Four provenance JSONs also moved into `design/media/gacha-2026-10-24/`. Active MP3s and both Clout images were retained byte-for-byte. The landing video poster reuses the existing final wall URL.

The selected footage remains silent H.264 at 1600x900, with the same 42-frame POV and 80-frame landing cuts, source windows, framing, timings and faststart. Alpha is unchanged. Compression is lossy; no visible degradation was found in reviewed full-frame/detail comparisons. Original supplied files and all prior derivatives are preserved. The delivery audit records exact hashes, byte counts and comparison metrics.

The current browser and release checks are summarized in `docs/design-update-release.md`; local recordings and reports are in `/home/falcon/Documents/New project 9/output/design-release-ready/`.

### Final quick-reveal correction

The card and caption mount at full opacity, with a small 300 ms slide/turn and no added impact overlays, deep flight, hold, or haul stagger. A first-time styled character also shows the card first; its existing banner celebration remains available as an optional replay rather than an automatic three-second gate. Exact first-print frame, fist, wordmark, name paper and visible foil assets warm during the existing paid sequence without delaying any reveal or receipt. No approved flight/smoke durations were changed by this correction.

### Smoke-to-card continuity

The smoke film ends and the saved card becomes interactive at the same 5,317 ms timeline boundary for single, partial and ten-pulls. The former 250/650 ms still-only hold is removed. The actual first card and arena mount in an inert, aria-hidden, nonmodal dialog behind the opaque smoke shot, with their entry animations disabled. Handoff promotes that same DOM to the native modal layer and starts the brief turn; it does not add a decode/loading gate. The underlying gym keeps its viewport geometry until the player dismisses the results, avoiding a Three.js resize on the cut.

The single-card background uses the same unshaded final wall framing as the film. The reveal no longer ramps a dark gradient or replays the ten-pull foreground burst. The earlier ten-pull impact during the smoke remains. Buffering after a video frame has been presented holds that last frame instead of flashing its poster; first-load and error posters remain available.

### Second media delivery pass

The same approved source windows and original image masters now produce **12,691,089 bytes**, another **19.52%** smaller than the first optimized package (15,769,163 bytes), or **38.70%** below the original 20,701,530 bytes. All video remains 1600×900 at the same frame counts and durations. Reviewed CRF22 veryslow encodes replace CRF20 slow; WebP80 images/posters retain dimensions and exact alpha. The 720p experiment was rejected. This remains lossy compression with visual comparisons, not a pixel-identical claim. Current provenance and byte/hash audits are in `design/media/gacha-2026-10-24/`.

The final normal-cache desktop and phone handoff cases pass. The last presented landing frame reaches the modal in 25.2/45.6 ms versus 332.4 ms in the desktop baseline; no separate still hold remains. Both first-visible recorded card frames contain the full print, portrait and fist, with no brightness flash or early card leak. Evidence and natural 1× previews are in `/home/falcon/Documents/New project 9/output/gacha-handoff-fix/README.md`. These are local SwiftShader fixtures, not hardware or production proof. The 46 cinematic/reward tests, 28 timing/film/battery checks (overlapping suites), frontend typecheck, production build and bundle/style budgets pass.
