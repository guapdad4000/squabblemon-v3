# Kumite 30-point expansion — implementation and release evidence

Base: `origin/main` / `f768e055a2996658efbf481ff4cef42cafff28d5`.
Branch: `codex/kumite-30-point-expansion`.
Status: local release candidate. This document records implementation and local evidence; deployment and authenticated-player verification are separate release checks. The older primary checkout's unrelated source work was preserved.

## Player-facing changes

- Kumite: Break the Bracket remains its own eight-episode Story special (`special-kumite-break-the-bracket`, Chapter 36 `kumite-break-the-bracket`), separate from Squabble House: The Last Waffle. Saved node IDs, encounters and progression remain intact. Ten optional training manuals branch between the episodes and never gate the established route. Each has a generated plate, an editable ordered sequence, keyboard/move-button/touch controls, hints, skip and the existing server-validated Story reward transaction. All ten use the shared ordering/validation engine; the cutman, counter-form and waveform themes do not add timed, pair-matching or rhythm minigame engines.
- Story now plays eight full chapter cuts from the 15:18.467 tournament master under `assets/kumite/films/story-v2/`, covering all 27,554 source frames once at 30 fps. The former short unlock loops are no longer the Story episode sources. Each chapter has a 1920×1080 landscape delivery and a 720×1280 portrait delivery preserving the entire wide picture with padding. Fourteen alpha lockups cover the eight Kumite films and six Last Waffle chapters. During playback, the HUD hides after 2.2 seconds without input and wakes on pointer or keyboard input; orientation switching retains playback time. Last Waffle keeps its own canonical films and quest, with no fabricated portrait movie where none exists.
- Five Grandmaster stages and ten lane NPC types have transparent six-frame animated WebP loops, static reduced-motion frames and windup/strike/recoil poses. The five Grandmasters are Chonk Lee, Dragonfly Jones, Franklin Duke, Bushedo Brown and Sho'Nuff. Intro cut-ins last 1.2 seconds. Hidden/offscreen or reduced-motion sprites stop looping through the shared playback observer.
- Collection includes a Boss & Dojo Archive: ten Precinct NPC records, ten Dojo NPC records and five Grandmaster plaques. These are static metadata, absent from playable card catalogs, saved crews and pack pools. Defeat stamps read the authenticated campaign's defeated-tier record. NPC formation inspection preserves the full population and static archive details.
- Eight fighters each have Base, Squabble and Awakened artworks plus a Grandmaster alternate. Confirmed Squabble receipts and effective Hands drive presentation; this adds no damage multiplier or new combat snapshot field. Awakened takes precedence at 10+ Hands or the existing special cue. A bounded 320 ms gold/crimson dissolve connects forms, respecting reduced motion.
- Dojo has two daily entries; Precinct retains one. Starts, retries, active-run resumption and the daily cap remain inside the profile-lock transaction. Daily reminders show the actual remaining count and hide after the campaign ends or entries are exhausted.
- Both the Safehouse Kumite shortcut and the actual 3D Arcade hotspot tooltip use the shared, intent-loaded bracket clock and server time offset.
- The road retains its yellow/black illustrated setting and SVG spine, with filters, both progression paths, restrained embers, a fighter dossier and three once-only side quests per fighter. Opening a dossier brings it into view on phones. Crew equip shows the exact replaced card, preserves ten unique cards and the hero, uses the normal server save endpoint and guards cache writes across account changes. Practice uses the saved active crew, opens with the chosen fighter in hand, returns to Kumite, and never calls an entry or reward mutation.

## Art contract and delivery

The user authorized built-in image generation in place of unavailable Imagen. No OpenArt jobs or credits were used. Art follows the existing cel-shaded arcade/anime references: heavy ink, restrained gold/crimson, identifiable character outfits, fists and no crown emblems. Generated masters remain outside Git; optimized WebP derivatives ship in `public/assets`.

71 art sets produce 131 WebP delivery files: 10 manual plates, 14 alpha lockups, 24 form plates, 8 alternate plates, and 15 sprite sets. Each sprite set includes its six-frame 960 ms idle loop plus a still and three attack poses. The generated review `media-manifest.json` records dimensions, alpha, frame count, bytes, delivery SHA-256 and source SHA-256. The local art ledger retains master provenance. Delivery totals approximately 20.5 MB, loaded by the relevant scene rather than eagerly at login.

The Glo plate deliberately has no baked node circles: seven HTML nodes and their current-order trace align the seven ordered cues at each viewport. Three generated sprite atlases were corrected to remove unwanted sparring partners before acceptance. Tiny disconnected atlas bleed was cleaned during delivery extraction; character poses and weapons remain intact.

Thirty-two responsive 320px portrait derivatives add approximately 2.34 MB for small card/dossier presentations; larger inspections retain the original art with fallback for missing derivatives. The sixteen full movies and sixteen posters are a separate cinema delivery, not part of the 20.5 MB art-only figure. Nine approved impact treatments and the six-drawing solo Dragonfly belt reaction are baked into those chapter movies without extending their frame counts. The full-resolution LaCie master and generated working cels remain outside the shipped public media. See [final media evidence](kumite-final-media-20261027.md), [cinema manifest](kumite-story-cinema-20261027.json), and [responsive art manifest](kumite-responsive-art-20261027.json) for current sizes, hashes, encoding and soundtrack status.

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
| 1 | Dim Mak Meridian Map: `storyKumitePuzzles.ts`, `meridian-map.webp`, five ordered fictional strike cues. |
| 2 | Find the Glo: `glo-conduit.webp`, seven ordered kinetic-chain cues and current-order trace. |
| 3 | Five-Form Manual: `five-form-manual.webp`, feint/counter ordering. |
| 4 | Reach Matrix: `reach-matrix.webp`, four scouting comparisons independent of the live bracket draw. |
| 5 | Bone-Impact X-Ray: `bone-impact.webp`, five-link force-chain ordering. |
| 6 | Wooden Dummy: `wooden-dummy.webp`, six-beat alternating-hand trap sequence. |
| 7 | Cutman Triage: `cutman-triage.webp`, fictional corner-bell priority sequence. |
| 8 | Qi Waveform: `qi-waveform.webp`, five ordered breathing cues; 12:57 refers to the full tournament clock, with a separate chapter-local timer. |
| 9 | Broken Timecode: `broken-timecode.webp`, corrected-clock chronology. |
| 10 | Grandmaster Seals: `grandmaster-seals.webp`, five-tier archive sequence. |
| 11 | Eight Kumite alpha lockups under `assets/kumite/titles`. |
| 12 | Six Last Waffle alpha lockups under `assets/story/squabble-house/titles`. |
| 13 | `StoryMovie.tsx` input-aware 2.2 s HUD timer and focus-safe CSS. |
| 14 | `StoryCinematic` orientation metadata and time-preserving switching between full chapter deliveries. |
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

## Initial expansion verification

The counts below describe the earlier feature/authority pass. Subsequent cinema, artwork and soundtrack revisions have their own evidence in the linked release manifests; these counts are not added together or presented as a new authenticated production run.

- 209 focused battle, Story, economy, form, archive and mastery regression tests pass with zero failures or skips.
- 24 native PostgreSQL route/transaction tests pass with zero failures or skips. A newly owned PostgreSQL 17 cluster on loopback used four pool connections; the test proves distinct backend PIDs. Coverage includes simultaneous reconciliation, account isolation, one-time grants, two Dojo entries, retry resumption, a rejected third entry, unchanged Precinct limits, mastery crafting rejection, and all ten manuals through real Story transactions. The temporary cluster is stopped and removed afterward.
- 14 media/economy checks pass, including existing Story and cosmetic asset contracts. Their overlapping tests are not added to the 209 total.
- Client source plus the review fixture and API source both type-check. Production compilation and the existing entry/GameApp/Home/soundtrack bundle guards pass. The existing large StoryStudio-chunk advisory remains an advisory; this is not a claim of all-device performance certification.
- Browser review exercised puzzle reordering/scrolling, real local Dojo play, 320×568, approximately 390×844, 844×390, 1024×768 and 1280×800 layouts, static archive inspection and reduced-motion phase rendering. No horizontal overflow or missing images occurred in the measured practice views. Runtime media dimensions and source paths were inspected.
- Cinema browser checks observed HUD hiding at roughly 2.2 seconds and a portrait-to-landscape source switch retaining playback time. The final keyboard wake-up was separately checked after the input fix.
- New art was inspected through contact sheets, full plates, sprite phases and the component review. Animated delivery verifies six frames, transparency and the three pose derivatives for all fifteen sets.

Re-run `pnpm test:kumite-expansion` for the focused source tests plus owned native database suite. Native PostgreSQL must be installed and the runner must execute as an unprivileged user; `KUMITE_POSTGRES_BIN` can point to the installed binaries. The suite refuses a caller-provided `DATABASE_URL`. `scripts/database-test-tiers.mjs` registers this required native suite so the embedded runner cannot silently omit it.

## Fighter form art revision 2

The 24 form plates were revised after review: 23 new dynamic-pose illustrations and the restored original Leroy Golden Glow. See [form art direction](kumite-form-art-direction.md). The approved non-form deliveries were preserved. This historical revision passed 14 focused checks and six local phone/desktop form views without runtime source changes. Current form sizes, hashes and revision provenance are recorded in `kumite-expansion-assets.json` rather than an older percentage.

## Fighter anatomy correction 3

Bushedo Brown and Chonk Lee received anatomically clearer Squabble poses. Only those two illustrations and media metadata changed; the other 129 delivery assets match their prior hashes. The 14 focused checks passed again, and desktop/phone component views showed both updated plates loaded correctly.

## Chonk Lee foot correction 4

The current asset ledger records `foot-anatomy-v4` for Chonk Lee's Squabble and Awakened plates, following the backward-foot/extra-toe review. These supersede the earlier Chonk Lee form derivatives; the ledger owns their current delivery hashes.

## Release boundary

This is a local implementation patch, not production or physical-device evidence. Browser review uses real components with explicitly synthetic review state; it does not authenticate a player or grant inventory. Authority is verified separately through real local API/database tests. Live account reminder delivery, full authenticated Safehouse navigation and deployment health remain production rollout checks. No new portrait films were fabricated for Last Waffle. No SQL schema migration is required for the additive receipt payload fields.
