# Kumite 30-point expansion — implementation and release evidence

Base: `origin/main` / `f768e055a2996658efbf481ff4cef42cafff28d5`.
Branch: `codex/kumite-30-point-expansion`.
Status: implemented and verified locally; not pushed or deployed. The older primary checkout's unrelated source work was preserved.

## Player-facing changes

- The eight existing Break the Bracket episodes retain their saved IDs, encounters and progression. Ten optional training manuals branch between them. Each uses a newly generated plate, an editable live sequence, keyboard/move-button/touch controls, hints, skip and the existing server-validated Story reward transaction. Optional drills do not gate the established eight-episode route.
- Fourteen alpha movie lockups cover the eight Kumite films and six Last Waffle chapters. During playback, the HUD hides after 2.2 seconds without input and wakes on pointer or keyboard input. Kumite switches between its existing authored portrait and landscape movies while retaining playback time. Last Waffle retains its canonical source where an authored portrait source does not exist.
- Five Grandmaster stages and ten lane NPC types have transparent six-frame animated WebP loops, static reduced-motion frames and windup/strike/recoil poses. The five Grandmasters are Chonk Lee, Dragonfly Jones, Franklin Duke, Bushedo Brown and Sho'Nuff. Intro cut-ins last 1.2 seconds. Hidden/offscreen or reduced-motion sprites stop looping through the shared playback observer.
- Collection includes a Boss & Dojo Archive: ten Precinct NPC records, ten Dojo NPC records and five Grandmaster plaques. These are static metadata, absent from playable card catalogs, saved crews and pack pools. Defeat stamps read the authenticated campaign's defeated-tier record. NPC formation inspection preserves the full population and static archive details.
- Eight fighters each have Base, Squabble and Awakened artworks plus a Grandmaster alternate. Confirmed Squabble receipts and effective Hands drive presentation; this adds no damage multiplier or new combat snapshot field. Awakened takes precedence at 10+ Hands or the existing special cue. A bounded 320 ms gold/crimson dissolve connects forms, respecting reduced motion.
- Dojo has two daily entries; Precinct retains one. Starts, retries, active-run resumption and the daily cap remain inside the profile-lock transaction. Daily reminders show the actual remaining count and hide after the campaign ends or entries are exhausted.
- Both the Safehouse Kumite shortcut and the actual 3D Arcade hotspot tooltip use the shared, intent-loaded bracket clock and server time offset.
- The road retains its yellow/black illustrated setting and SVG spine, with filters, both progression paths, restrained embers, a fighter dossier and three once-only side quests per fighter. Opening a dossier brings it into view on phones. Crew equip shows the exact replaced card, preserves ten unique cards and the hero, uses the normal server save endpoint and guards cache writes across account changes. Practice uses the saved active crew, opens with the chosen fighter in hand, returns to Kumite, and never calls an entry or reward mutation.

## Art contract and delivery

The user authorized built-in image generation in place of unavailable Imagen. No OpenArt jobs or credits were used. Art follows the existing cel-shaded arcade/anime references: heavy ink, restrained gold/crimson, identifiable character outfits, fists and no crown emblems. Generated masters remain outside Git; optimized WebP derivatives ship in `public/assets`.

71 art sets produce 131 WebP delivery files: 10 manual plates, 14 alpha lockups, 24 form plates, 8 alternate plates, and 15 sprite sets. Each sprite set includes its six-frame 960 ms idle loop plus a still and three attack poses. The generated review `media-manifest.json` records dimensions, alpha, frame count, bytes, delivery SHA-256 and source SHA-256. The local art ledger retains master provenance. Delivery totals approximately 20.5 MB, loaded by the relevant scene rather than eagerly at login.

The Glo plate deliberately has no baked node circles: seven HTML nodes and their current-order trace provide an exact seven-node instrument at every viewport. Three generated sprite atlases were corrected to remove unwanted sparring partners before acceptance. Tiny disconnected atlas bleed was cleaned during delivery extraction; character poses and weapons remain intact.

## Mastery and economy rules

Every fighter has three side quests: a three-district weekly win with that fighter in the recorded crew; 35+ damage in a completed Tier 3+ Dojo run with that fighter in the crew; and a recorded player-owned 10+ Hands appearance in a Dojo blast. Each quest grants 20 universal Style Shards once per account. The total new side-quest allowance is 480 Shards across eight fighters, separate from existing raid payouts.

Grandmaster art requires ownership, the mapped Dojo tier clear and an actual weekly win receipt recording that fighter in the crew. Old receipts without crew evidence remain valid for old rewards but do not invent fighter-specific mastery. Precinct runs cannot satisfy the new mastery conditions. Practice has no receipt path. A `progressionOnly` variant is excluded from pack bonuses and rejected by the crafting endpoint; a zero price is an internal sentinel, not a free purchase.

| Fighter | Required Dojo tier |
| --- | ---: |
| Chonk Lee | 1 |
| Dragonfly Jones | 2 |
| Franklin Duke | 3 |
| Bushedo Brown | 4 |
| Sho'Nuff | 5 |
| Leroy | 5 |
| Undercova Brotha | 4 |
| P. Tang | 3 |

The ninth pre-existing road reward, Yasuke, remains available. The new three-form art set is limited to the eight specified fighters; Yasuke does not advertise ungenerated form plates.

## 30-point source map

| Item | Implementation |
| --- | --- |
| 1 | Dim Mak Meridian Map: `storyKumitePuzzles.ts`, `meridian-map.webp`, live five-node trace. |
| 2 | Find the Glo: `glo-conduit.webp`, seven-node kinetic-chain instrument. |
| 3 | Five-Form Manual: `five-form-manual.webp`, feint/counter ordering. |
| 4 | Reach Matrix: `reach-matrix.webp`, four seeded matchup clues. |
| 5 | Bone-Impact X-Ray: `bone-impact.webp`, five-link force-chain calibration. |
| 6 | Wooden Dummy: `wooden-dummy.webp`, six-beat alternating-hand trap sequence. |
| 7 | Cutman Triage: `cutman-triage.webp`, fictional corner-bell priority sequence. |
| 8 | Qi Waveform: `qi-waveform.webp`, five breathing beats and 12:57 cue. |
| 9 | Broken Timecode: `broken-timecode.webp`, corrected-clock chronology. |
| 10 | Grandmaster Seals: `grandmaster-seals.webp`, five-tier archive sequence. |
| 11 | Eight Kumite alpha lockups under `assets/kumite/titles`. |
| 12 | Six Last Waffle alpha lockups under `assets/story/squabble-house/titles`. |
| 13 | `StoryMovie.tsx` input-aware 2.2 s HUD timer and focus-safe CSS. |
| 14 | `StoryCinematic` orientation metadata and time-preserving source switching. |
| 15 | Five Grandmaster sprite sets, `BossIdleSprite` / `DojoMotionSprite`. |
| 16 | Ten dedicated Dojo lane sprite sets and static formation views. |
| 17 | Blast-driven phase swaps and bounded gold/red strike/recoil effects. |
| 18 | `bossArchive.ts`, `BossArchive`, `BossArchiveInspector`, Collection tab and CardInspector dispatch. |
| 19 | Campaign-derived defeated-tier plaques; no client-created defeat claim. |
| 20 | A 1.2 s cut-in for each newly launched Dojo run. |
| 21 | Eight new Base plates under `assets/characters/forms`, preserving original master art. |
| 22 | Eight Squabble plates, using existing confirmed play receipts. |
| 23 | Eight Awakened plates, using effective Hands / special cues. |
| 24 | Eight earned alternates, private mastery projection and transactional variant grants. |
| 25 | `KumiteFormPortrait`: bounded 320 ms dissolve/radial flash and original-art fallback. |
| 26 | `DailyCheckInArrival`, `notificationCatalog` export, shared Dojo reminder query and authoritative daily cap. |
| 27 | `useKumiteHotspotClock`, `KumiteShortcut`, Home's 3D Arcade marker tooltip. |
| 28 | Both road paths, existing SVG spine, filters and visibility-safe presentation. |
| 29 | Three per-fighter server-checked quests, once-only receipts and Shard credits. |
| 30 | `KumiteCrewActions`, saved-crew local practice, correct return route and no live entry/reward mutation. |

Engine source is in `lib/squabblemon-engine/src`. Client source is in `artifacts/squabblemon/src`. API authority is in `artifacts/api-server/src/lib`. `Battle.tsx` already forwards confirmed Squabble IDs and effective Hands to shared CardView; the same projection is now connected in BossRaidView without changing normal combat rules.

## Verification

- 209 focused battle, Story, economy, form, archive and mastery regression tests pass with zero failures or skips.
- 24 native PostgreSQL route/transaction tests pass with zero failures or skips. A newly owned PostgreSQL 17 cluster on loopback used four pool connections; the test proves distinct backend PIDs. Coverage includes simultaneous reconciliation, account isolation, one-time grants, two Dojo entries, retry resumption, a rejected third entry, unchanged Precinct limits, mastery crafting rejection, and all ten manuals through real Story transactions. The temporary cluster is stopped and removed afterward.
- 14 media/economy checks pass, including existing Story and cosmetic asset contracts. Their overlapping tests are not added to the 209 total.
- Client source plus the review fixture and API source both type-check. Production compilation and the existing entry/GameApp/Home/soundtrack bundle guards pass. The existing large StoryStudio-chunk advisory remains an advisory; this is not a claim of all-device performance certification.
- Browser review exercised puzzle reordering/scrolling, real local Dojo play, 320×568, approximately 390×844, 844×390, 1024×768 and 1280×800 layouts, static archive inspection and reduced-motion phase rendering. No horizontal overflow or missing images occurred in the measured practice views. Runtime media dimensions and source paths were inspected.
- Cinema browser checks observed HUD hiding at roughly 2.2 seconds and a portrait-to-landscape source switch retaining playback time. The final keyboard wake-up was separately checked after the input fix.
- New art was inspected through contact sheets, full plates, sprite phases and the component review. Animated delivery verifies six frames, transparency and the three pose derivatives for all fifteen sets.

Re-run `pnpm test:kumite-expansion` for the focused source tests plus owned native database suite. Native PostgreSQL must be installed and the runner must execute as an unprivileged user; `KUMITE_POSTGRES_BIN` can point to the installed binaries. The suite refuses a caller-provided `DATABASE_URL`. `scripts/database-test-tiers.mjs` registers this required native suite so the embedded runner cannot silently omit it.

## Fighter form art revision 2

The 24 form plates were revised after review: 23 new dynamic-pose illustrations and the restored original Leroy Golden Glow. See [form art direction](kumite-form-art-direction.md). All 107 approved non-form delivery files are hash-identical. The form set is 18.2% smaller; 14 focused checks and six local phone/desktop form views passed. Runtime source remains unchanged in this artwork revision.

## Fighter anatomy correction 3

Bushedo Brown and Chonk Lee received anatomically clearer Squabble poses. Only those two illustrations and media metadata changed; the other 129 delivery assets match their prior hashes. The 14 focused checks passed again, and desktop/phone component views showed both updated plates loaded correctly.

## Release boundary

This is a local implementation patch, not production or physical-device evidence. Browser review uses real components with explicitly synthetic review state; it does not authenticate a player or grant inventory. Authority is verified separately through real local API/database tests. Live account reminder delivery, full authenticated Safehouse navigation and deployment health remain production rollout checks. No new portrait films were fabricated for Last Waffle. No SQL schema migration is required for the additive receipt payload fields.
