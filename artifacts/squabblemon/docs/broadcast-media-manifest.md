# Broadcast media preparation — Task 265, step 1

## Catalog contract

`src/lib/broadcastCatalog.ts` exports `LoadingScene`, `RewardClip`, `loadingScenes`, and `rewardClips`. The reward type is `type RewardClip = {id:string,video:string,poster:string,duration:number,style:"anime"|"live-action",tags:ReadonlyArray<"victory"|"defeat"|"draw"|"reward">}`. All URLs are base-relative (no leading slash), unique IDs are used, and every runtime item has at least one reachable placement tag. This is metadata only; media consumers remain outside this step.

## Delivery totals

- Landscape scenes: 3,589,967 video bytes / 3 loops; 394,940 poster bytes / 3 posters.
- Portrait clips: 3,120,544 video bytes / 22 clips; 620,312 poster bytes / 22 posters.
- Combined runtime derivatives: 7,725,763 bytes (video + posters).
- Limits met: landscape video <=2,000,000 bytes; loading posters <=200,000 bytes; each reward video <=1,000,000 bytes and 1–3 seconds; reward posters <=150,000 bytes. All MP4 derivatives are silent H.264 with only the primary video stream; the original AAC and attached thumbnail stream are not included.

## Landscape loading scenes

| ID | Source range | Delivered duration | Video and actual size | Poster and actual size | Portrait / landscape position |
|---|---|---:|---|---|---|
| loading-sunset-street | ../../attached_assets/grok-video-d94e8556-0973-42a4-9c71-93ab89f91961_(1)_1790777681163.mp4 0.00–6.04 s | 6.042 s | brand/broadcast/loading/sunset-street.mp4 (1310.0 KiB (1,341,438 bytes)) | brand/broadcast/loading/sunset-street.jpg (146.6 KiB (150,134 bytes)) | center 54% / center 50% |
| loading-squabblehouse | ../../attached_assets/grok-video-f8ade026-eb3d-443d-9f78-75819c986e38_(1)_1790777700939.mp4 0.00–6.04 s | 6.042 s | brand/broadcast/loading/squabblehouse.mp4 (624.4 KiB (639,366 bytes)) | brand/broadcast/loading/squabblehouse.jpg (106.8 KiB (109,355 bytes)) | center 48% / center 50% |
| loading-fade-park | ../../attached_assets/grok-video-537afb19-2f61-48ab-bd14-8cdd47ae03ac_1790777728143.mp4 0.00–6.04 s | 6.042 s | brand/broadcast/loading/fade-park.mp4 (1571.4 KiB (1,609,163 bytes)) | brand/broadcast/loading/fade-park.jpg (132.3 KiB (135,451 bytes)) | center 50% / center 51% |

## Reward clips

| ID | Style | Source range | Duration | Video and actual size | Poster and actual size | Reachable tags | Edit |
|---|---|---:|---:|---|---|---|---|
| anime-opponent-down | anime | 24.00–25.00 s | 1.000 s | brand/broadcast/rewards/anime-opponent-down.mp4 (85.7 KiB (87,747 bytes)) | brand/broadcast/rewards/anime-opponent-down.jpg (34.0 KiB (34,826 bytes)) | victory | The blue-bandana fighter falls and lies down as the opponent remains standing; cut before the K.O. title. |
| anime-crowd-draw | anime | 59.00–60.00 s | 1.000 s | brand/broadcast/rewards/anime-crowd-draw.mp4 (109.7 KiB (112,286 bytes)) | brand/broadcast/rewards/anime-crowd-draw.jpg (34.4 KiB (35,223 bytes)) | draw | Wide, unresolved brawl beat with several fighters still active and no clear winner. |
| anime-first-impact | anime | 60.00–60.50 s | 1.000 s | brand/broadcast/rewards/anime-first-impact.mp4 (106.8 KiB (109,332 bytes)) | brand/broadcast/rewards/anime-first-impact.jpg (33.3 KiB (34,119 bytes)) | victory | First face punch from the later fight sequence. |
| anime-second-impact | anime | 63.25–64.00 s | 1.042 s | brand/broadcast/rewards/anime-second-impact.mp4 (165.4 KiB (169,406 bytes)) | brand/broadcast/rewards/anime-second-impact.jpg (26.2 KiB (26,861 bytes)) | victory | A distinct later face punch by a different fighter in the second brawl sequence. |
| anime-uppercut-safe-edit | anime | 65.25–65.75 s | 1.042 s | brand/broadcast/rewards/anime-uppercut-safe-edit.mp4 (146.0 KiB (149,518 bytes)) | brand/broadcast/rewards/anime-uppercut-safe-edit.jpg (27.3 KiB (27,913 bytes)) | victory | The later uppercut/third-punch beat followed by the opponent's reaction. |
| anime-car-launch | anime | 69.00–69.75 s | 1.042 s | brand/broadcast/rewards/anime-car-launch.mp4 (105.7 KiB (108,259 bytes)) | brand/broadcast/rewards/anime-car-launch.jpg (28.7 KiB (29,436 bytes)) | victory | A fighter is thrown beside a parked car in a brief action insert. |
| anime-fight-clears | anime | 66.00–68.00 s | 2.000 s | brand/broadcast/rewards/anime-fight-clears.mp4 (145.3 KiB (148,826 bytes)) | brand/broadcast/rewards/anime-fight-clears.jpg (34.0 KiB (34,809 bytes)) | victory | Wide fight-clears aftermath with a standing fighter and several opponents down on the street. |
| anime-chef-forward-punch | anime | 70.50–72.00 s | 1.500 s | brand/broadcast/rewards/anime-chef-forward-punch.mp4 (158.7 KiB (162,515 bytes)) | brand/broadcast/rewards/anime-chef-forward-punch.jpg (43.3 KiB (44,295 bytes)) | victory | The Squabblehouse-apron fighter steps forward and thrusts a fist from the kitchen doorway. |
| anime-falling-bandana | anime | 61.25–62.40 s | 1.167 s | brand/broadcast/rewards/anime-falling-bandana.mp4 (113.0 KiB (115,727 bytes)) | brand/broadcast/rewards/anime-falling-bandana.jpg (26.6 KiB (27,251 bytes)) | reward | A red bandana drifts against a dark field, with only partial raised hands at the lower edge; no punch landing or KO is shown. |
| anime-street-aftermath | anime | 84.25–84.75 s | 1.042 s | brand/broadcast/rewards/anime-street-aftermath.mp4 (69.7 KiB (71,399 bytes)) | brand/broadcast/rewards/anime-street-aftermath.jpg (29.0 KiB (29,725 bytes)) | defeat | Quiet lamp-lit street with a fallen fighter, after the action has cleared. |
| live-first-impact | live-action | 16.00–17.80 s | 1.792 s | brand/broadcast/rewards/live-first-impact.mp4 (112.4 KiB (115,127 bytes)) | brand/broadcast/rewards/live-first-impact.jpg (22.9 KiB (23,400 bytes)) | victory | Close-range punch lands against the blue-bandana fighter. |
| live-finishing-punch | live-action | 22.25–23.25 s | 1.000 s | brand/broadcast/rewards/live-finishing-punch.mp4 (71.0 KiB (72,754 bytes)) | brand/broadcast/rewards/live-finishing-punch.jpg (21.3 KiB (21,790 bytes)) | victory | A gloved fist connects in the close-range finishing punch. |
| live-knockdown | live-action | 25.50–27.30 s | 1.792 s | brand/broadcast/rewards/live-knockdown.mp4 (189.9 KiB (194,472 bytes)) | brand/broadcast/rewards/live-knockdown.jpg (36.7 KiB (37,541 bytes)) | victory | The opponent lies on the ground while the red-bandana fighter stands; no title card. |
| live-isolated-fist | live-action | 32.00–33.50 s | 1.500 s | brand/broadcast/rewards/live-isolated-fist.mp4 (112.3 KiB (114,953 bytes)) | brand/broadcast/rewards/live-isolated-fist.jpg (24.8 KiB (25,352 bytes)) | reward | A ring-gloved fist held close to camera with no target/person visible. |
| live-sunglasses-jab | live-action | 39.50–40.75 s | 1.250 s | brand/broadcast/rewards/live-sunglasses-jab.mp4 (205.5 KiB (210,467 bytes)) | brand/broadcast/rewards/live-sunglasses-jab.jpg (24.9 KiB (25,503 bytes)) | victory | The sunglasses fighter's separate jab, with the red-suited figure only in the background. |
| live-side-kick | live-action | 34.50–35.25 s | 1.042 s | brand/broadcast/rewards/live-side-kick.mp4 (133.6 KiB (136,839 bytes)) | brand/broadcast/rewards/live-side-kick.jpg (21.3 KiB (21,784 bytes)) | victory | The side kick and opponent recoil, distinct from either close-up punch. |
| live-chef-counter | live-action | 52.25–54.05 s | 1.833 s | brand/broadcast/rewards/live-chef-counter.mp4 (301.0 KiB (308,274 bytes)) | brand/broadcast/rewards/live-chef-counter.jpg (24.4 KiB (25,014 bytes)) | victory | Chef counterattack in the crowd brawl. |
| live-falling-bandana | live-action | 61.25–62.95 s | 1.708 s | brand/broadcast/rewards/live-falling-bandana.mp4 (181.9 KiB (186,229 bytes)) | brand/broadcast/rewards/live-falling-bandana.jpg (21.0 KiB (21,459 bytes)) | reward | The red bandana falls and comes to rest on the pavement; no target or KO is visible. |
| live-ground-fist | live-action | 60.25–61.25 s | 1.000 s | brand/broadcast/rewards/live-ground-fist.mp4 (129.3 KiB (132,426 bytes)) | brand/broadcast/rewards/live-ground-fist.jpg (21.2 KiB (21,682 bytes)) | draw | A ground-fist impact against pavement with no opponent struck and no outcome shown. |
| live-crowd-draw | live-action | 57.75–59.75 s | 2.000 s | brand/broadcast/rewards/live-crowd-draw.mp4 (150.6 KiB (154,173 bytes)) | brand/broadcast/rewards/live-crowd-draw.jpg (27.9 KiB (28,591 bytes)) | draw | Several fighters exchange blows in a wide street view with no clear winner. |
| live-last-collapse | live-action | 78.25–79.75 s | 1.500 s | brand/broadcast/rewards/live-last-collapse.mp4 (142.0 KiB (145,431 bytes)) | brand/broadcast/rewards/live-last-collapse.jpg (23.9 KiB (24,429 bytes)) | defeat | The final fighter collapses onto the pavement after the red-eyed figure's approach. |
| live-quiet-aftermath | live-action | 83.75–85.75 s | 2.000 s | brand/broadcast/rewards/live-quiet-aftermath.mp4 (111.7 KiB (114,384 bytes)) | brand/broadcast/rewards/live-quiet-aftermath.jpg (18.9 KiB (19,309 bytes)) | defeat | Quiet street closing shot with a fallen fighter under the lamp. |

## Portrait-montage source audit and omissions

| Source | Audited range | Moment | Decision / rationale |
|---|---:|---|---|
| A | 0–9 s | Crowd gathers / arena arrival | Opening-only establishing material; deferred, not exported. |
| B | 0–9.5 s | Squabblehouse arrival / crowd | Opening-only establishing material; deferred, not exported. |
| B | 9.5–11 s | Split-bandana eyes and FIGHT title | Pre-fight title/faceoff; deferred. |
| A | 9–15 s | Bandana fighters square up | Faceoff; deferred. |
| B | 11–15 s | Bandana fighters square up | Faceoff; deferred. |
| A | 15–18.5 s | Fist toward camera / impact close-up | Exported as live-first-impact (16.00–17.80); outcome-specific victory. |
| B | 15–17.5 s | First monochrome impact | High-contrast monochrome impact panel; excluded for rapid flash risk. |
| A | 18.5–21 s | Crowd arena view | Repeated establishing view; excluded and opening use is deferred. |
| B | 17.5–21 s | Arena/crowd view | A wide unresolved brawl take at 59–60 is exported as anime-crowd-draw; the earlier arena establishing view remains deferred. |
| A | 21–24 s | Close-range finishing punch | Exported as live-finishing-punch (22.25–23.25); victory. |
| B | 21–24 s | Close-range finishing punch | Mostly setup/pose; impact is followed by monochrome panels, excluded as an unsafe near-duplicate. |
| A | 24–27 s | Opponent down / K.O. beat | Exported as live-knockdown (25.50–27.30), title omitted; victory-only. |
| B | 24–27 s | Opponent down / K.O. title | Frames 24.00–25.00 are exported as anime-opponent-down; the K.O. title starts at 25.00 and is excluded. |
| A | 27–31 s | New challenger squares up | Faceoff material; deferred. |
| B | 27–30.5 s | New challenger squares up | Faceoff material; deferred. |
| A | 31–33 s | Ring-fist / sunglasses punch | Ring-fist object detail exported as live-isolated-fist (32.00–33.50) for reward only; no person is hit. |
| B | 30.5–33 s | Ring-fist / sunglasses punch | Fast portrait-to-punch transition and white/monochrome frames; excluded for flash risk. |
| A | 33–36 s | Side kick / opponent recoils | Exported as live-side-kick (34.50–35.25), retimed from 0.75 s to 1.00 s to avoid the red-plaid close-up; victory. |
| B | 33–35.5 s | Side kick / opponent recoils | The presumed kick is a monochrome/white flash sequence; the remaining color interval cuts directly into the red-plaid threat portrait, leaving no safe coherent >=1-second take. Deferred/excluded. |
| A | 36–39 s | Red-plaid fighter grin/portrait | Threat portrait; opening placement deferred. |
| B | 35.5–39 s | Red-plaid fighter grin/monochrome portrait | Threat portrait and high-contrast manga flashes; deferred/excluded. |
| A | 39–42 s | Sunglasses boxer and red-suited boss | The red-suited boss portrait remains deferred; the separate sunglasses-boxer jab is exported as live-sunglasses-jab (39.50–40.75), victory. |
| B | 39–41.5 s | Red-eyed figure arrives | Threat/entrance portrait; deferred. |
| A | 42–45 s | Red-eyed figure arrival/close-up | Threat portrait; deferred. |
| B | 41.5–45.5 s | Red-eyed figure arrival/close-up | Threat portrait; deferred. |
| A | 45–48 s | Chef at window | Entrance/portrait; deferred. |
| B | 45.5–48.5 s | Chef at window | Entrance/portrait; deferred. |
| A | 48–51 s | Chef emerges/winds up | Chef entrance; deferred. |
| B | 48.5–51.5 s | Chef dining/portrait | Unrelated held food portrait; not a distinct reward action, excluded. |
| A | 51–54 s | Chef counterattack / impact | Exported as live-chef-counter (52.25–54.05); victory. |
| B | 51.5–54.5 s | Chef at the table / eating | Not a combat counterattack in inspected frames; held eating portrait, excluded. |
| A | 54–57 s | Doorway challenge | Faceoff/challenge; deferred. |
| B | 54.5–58 s | Doorway challenge | Faceoff/challenge; deferred. |
| A | 57–60 s | Full crowd brawl | Exported as live-crowd-draw (57.75–59.75), draw-only: broad unresolved combat, never a noncombat reward. |
| B | 58–60 s | Crowd brawl | Exported as anime-crowd-draw (59.00–60.00), draw-only: several fighters remain active with no declared winner. |
| A | 60–61 s | Ground-fist insert | Exported as live-ground-fist (60.25–61.25), draw-only combat impact; not context-neutral and never a generic reward. |
| B | 60–61.2 s | First face punch | Exported as anime-first-impact (60.00–60.50), a continuous color hit slowed from 0.50 s to 1.00 s; victory. |
| A | 61–63 s | Falling red bandana | Exported as live-falling-bandana (61.25–62.95) as isolated falling cloth; reward-only. |
| B | 61.2–62.5 s | Falling red bandana | Exported as anime-falling-bandana (61.25–62.40), ending before the next person-impact shot; reward-only. |
| A | 63–66 s | Ground reaction | The face reaction is a very brief, motion-blurred close-up followed immediately by lights/pavement; no coherent >=1-second portrait take, so audit-only. |
| B | 62.5–64 s | Second face punch | A distinct later punch by a different fighter is exported as anime-second-impact (63.25–64.00) at 0.75x, victory; separate from the first punch at 60–61.2. |
| B | 64–66 s | Third face punch / uppercut | Monochrome panels at 64.75–65.25 are excluded; a color-only uppercut/reaction edit is exported as anime-uppercut-safe-edit (65.25–65.75) at 0.5x, victory. |
| A | 66–69 s | Fight clears / fighters down | Crowded multi-fall brawl has no clean short single-take outcome; excluded, not collapsed into a neutral reward or one winner. |
| B | 66–69 s | Fight clears / fighters down | Continuous, color-only street aftermath exported as anime-fight-clears (66.00–68.00): one fighter remains upright while several others are down, distinct from the earlier wide draw brawl. |
| B | 69–70 s | Car-side launch | Exported as anime-car-launch (69.00–69.75) at 0.75x; ends before the following unrelated shot. |
| B | 70–72 s | Chef-forward punch | The Squabblehouse-apron fighter turns and thrusts a fist; exported as anime-chef-forward-punch (70.50–72.00), victory, ending before the night-street cut. |
| A | 69–78 s | Lone threatening figure after brawl | Threat/entrance material; deferred, not a reward outcome. |
| B | 72–78 s | Lone threatening figure after brawl | Threat/entrance material; deferred. |
| A | 78–81 s | Last fighter collapses | Exported as live-last-collapse (78.25–79.75), defeat-only action, separate from the later quiet aftermath. |
| B | 78–81 s | Last fighter collapses | Outcome frames mix standing threat and falls; excluded for clarity. |
| A | 81–90 s | Quiet street / fallen fighter under lamp | One static closing composition exported as live-quiet-aftermath (83.75–85.75); defeat-only, separate from live-last-collapse. |
| B | 81–90 s | Quiet street / fallen fighter under lamp | One stable-light composition exported as anime-street-aftermath (84.25–84.75) at half speed; later alternating lamp/dark frames are omitted. |

### Frame review, editing, and safety

- Reviewed full-timeline half-second contact sheets for both 90-second sources and quarter-second detail sheets around candidate action/ending windows. High-rate frame checks cover the chef forward punch, the 66–68 fight-clears aftermath, the live chef counter, and the live sunglasses jab. Files are listed in `portraitAudit.contactSheets` and are at `docs/media-audit/contact-sheets/`: full-timeline anime/live sheets, detail/boundary sheets, source loading-scene sheets, high-rate action checks, and `exported-clips-review.jpg`. The export review sheet includes every encoded portrait cut sampled at 4 fps, with per-cut sheets in `docs/media-audit/exports/`.
- Monochrome manga impact panels and abrupt color/black/white alternations were identified in anime around 15.5–19.0, 31.25–34.0, 38.75–39.75, 53.75–54.5, 62.75–63.25, and 64.75–65.25 seconds. Selected clips omit those high-contrast panels: the first face-punch cut uses 60.00–60.50; the second-punch cut uses 63.25–64.00; and the uppercut safe edit 65.25–65.75, then retimes each continuous color take to one second. The 66.00–68.00 fight-clears aftermath is continuous color at the original frame rate. The quiet street defeat clip is slowed from a stable-lit half-second to avoid alternating lamp/dark frames. The colored K.O. title at 25.00 is excluded from the anime opponent-down cut.
- Live-action exports were inspected at quarter-second boundaries; selected takes use normal color footage without inserted monochrome flashes. The isolated-glove-fist and falling-bandana clips alone carry `reward` and do not show a punch landing on a person or a KO. These object cuts are distinct from combat-only ground-fist/crowd-brawl cuts, which carry `draw`, not `reward`. Victory punches/kicks/knockdowns are tagged `victory`; last-collapse/quiet aftermath clips are tagged `defeat`; broad unresolved brawls and ground-fist impact carry `draw`. The inspected 63–66-second ground reaction is omitted because the close-up is too brief and motion-blurred to yield a coherent one-second cut.
- The anime falling-bandana cut ends before the next face-punch shot. Source A's chef counterattack (52.25–54.05) is exported as live-chef-counter. Source B's 51–54.5 chef-table sequence is held eating/dining rather than a strike; separately, the Squabblehouse-apron character turns and extends a fist from the kitchen doorway at 70.50–72.00, including the arm extension through 71.75 and ending before the unrelated night-street cut. The sunglasses-boxer jab at 39.50–40.75 is distinct from the red-suited boss portrait/hold and is exported as victory. The 66–68 multibody fight-clears view is a continuous, color-only aftermath and is separately included rather than conflated with the earlier unresolved crowd draw. The final-collapse action and quiet aftermath remain separate. Openings, faceoffs, threat/entrance portraits, and FIGHT lettering remain deferred, not runtime exports. A held repeated shot does not become several exports. No generated content or audio was added.
- Review contact sheets are audit documents only; no source montage or contact sheet is referenced at runtime. Original files remain in `attached_assets` and no runtime derivative links to them.

## All five supplied sources

- **loading-sunset-street**: `../../attached_assets/grok-video-d94e8556-0973-42a4-9c71-93ab89f91961_(1)_1790777681163.mp4` (8,495,224 bytes, 6.042 s, 1280x720, h264 1280x720, aac, mjpeg 1280x720). Landscape loading-scene loop; primary video stream only in public derivative.
- **loading-squabblehouse**: `../../attached_assets/grok-video-f8ade026-eb3d-443d-9f78-75819c986e38_(1)_1790777700939.mp4` (4,508,046 bytes, 6.042 s, 1280x720, h264 1280x720, aac, mjpeg 1280x720). Landscape loading-scene loop; primary video stream only in public derivative.
- **loading-fade-park**: `../../attached_assets/grok-video-537afb19-2f61-48ab-bd14-8cdd47ae03ac_1790777728143.mp4` (9,724,784 bytes, 6.042 s, 1264x720, h264 1264x720, aac, mjpeg 1264x720). Landscape loading-scene loop; primary video stream only in public derivative.
- **source-a-live-action**: `../../attached_assets/d779446a-0f1_ae3862ef_1790742851727_1790778124763.mp4` (35,231,797 bytes, 90.034 s, 720x1280, h264 720x1280, aac). Source for 12 short silent live-action edits; original is not a runtime asset.
- **source-b-anime**: `../../attached_assets/openart-c9e95da7-239_3660c019_1790762667633_1790778146400.mp4` (28,381,289 bytes, 90.034 s, 720x1280, h264 720x1280, aac). Source for 10 short silent anime edits; original is not a runtime asset.

## Processing provenance

Run `node scripts/process-broadcast-media.mjs` from `artifacts/squabblemon` to re-encode the authored edit ranges and refresh actual sizes in the manifests. The script maps only stream 0 (primary video), omits audio/subtitles/data/metadata, generates matched JPEG posters, probes outputs, and fails when a stated byte or duration cap is exceeded.
