# Kumite & Martial Arts Cinema Expansion — 30-Point Codex & Imagen Handoff Spec

> **Status on `origin/main`:**
> - **8-Episode `Kumite: Break the Bracket` Special (`special-kumite-break-the-bracket` / Chapter 36 `kumite-break-the-bracket`)** is registered and live in `lib/squabblemon-engine/src/storyKumite.ts` & `storySeasons.ts`.
> - **Fullscreen Episode Cinema Player (`StoryMovie.tsx` + `squabble-house.css`)** now plays videos edge-to-edge (`100vw × 100dvh`) with floating top/bottom translucent HUD bars and a native `⛶ Fullscreen` toggle.
> - **Kumite 4-Mode Command Hub (`Kumite.tsx`)** includes a minimal live **Next Bracket Lock Countdown Clock**, and **Yellow-and-Black Unlock Roadmap (`KumiteRewards.tsx`)** now includes the **Active Dojo Mission Tracker**, SVG spine connectors, `ALL 9 / IN PROGRESS / UNLOCKED` filters, and a **3-Form Dynamic Squabble Stance Previewer (`01 · Base`, `02 · Squabble 2×`, `03 · Awakened 10+ Hands`)**.
> - **Fadecade Desktop-Chrome & Fluff Removal** is complete across `Girl Fade`, `Fade Market`, `Block Takeover`, `Waffle Run`, `Check the Block`, `Stockz`, `Straight to the Back`, and `Street Events`.

---

## The 30-Point Brainstorm & Implementation Blueprint for Codex (Imagen + Code)

### I. Martial Arts Anatomy, Pressure-Point, Chakra & Kung Fu Manual Story Puzzles (Items 1–10)
*Use `StoryPuzzleDefinition` in `lib/squabblemon-engine/src/storyPuzzles.ts` + Imagen-generated `16:9` / `1:1` diagram plates under `public/assets/story/puzzles/kumite/` to add interactive martial-arts puzzles between the 8 `Break the Bracket` episodes:*

1. **Dim Mak Pressure-Point Meridian Map (`Episode 02 · Belt Check`):**
   - **Imagen Art:** Vintage worn parchment acupuncture/vital-point chart of a martial artist's torso with glowing gold & crimson nerve nodes (`solar-plexus`, `floating-rib`, `carotid-gate`, `brachial-knot`, `liver-hook`).
   - **Mechanic:** Order the 5 pressure points in the exact strike sequence needed to break an iron guard without wasting Motion.
2. **Seven-Chakra / "Find the Glo" Conduit Alignment (`Episode 03 · Find the Glo`):**
   - **Imagen Art:** Double-exposure silhouette of Leroy in lotus/horse stance with 7 illuminated bio-electric chakra nodes (`root-stance`, `sacral-hip-torque`, `solar-core`, `heart-rhythm`, `throat-kiai`, `third-eye-read`, `crown-glo`).
   - **Mechanic:** Connect the kinetic chain from the floor (`root-stance`) through the hips and shoulders up to the `crown-glo` counter-uppercut.
3. **1970s Shaw Brothers Fold-Out Kung Fu Manual — 5-Form Sequence (`Episode 04 · Professional Courtesy`):**
   - **Imagen Art:** Distressed ink-and-vermilion woodblock kung fu manual showing Bushedo Brown's 5 defensive parries (`Crane Wing Deflect`, `Serpent Wrist Lock`, `Tiger Palm Check`, `Mantis Elbow Trap`, `Iron Sweeping Root`).
   - **Mechanic:** Match each of Undercova Brotha's 5 opening feints to the single counter-form that neutralizes it according to the manual's footwork arrows.
4. **Tale of the Tape — Fight Anatomy & Boxing Reach Matrix (`Episode 01 · The Invitation`):**
   - **Imagen Art:** Ringside chalkboard & X-ray skeletal reach chart comparing wingspan, southpaw/orthodox stance angles, hand speed, and chin durability across the 8 Kumite contenders.
   - **Mechanic:** Seed the 4 Quarterfinal matchups using the true reach, weight-class, and southpaw angle clues on the ringside fight card.
5. **Kinetic Punch Telemetry & Bone-Impact X-Ray (`Episode 06 · The Arena Is Ours`):**
   - **Imagen Art:** Neon-gold X-ray impact frame showing metacarpal alignment, radius/ulna rotation, scapular lock, and ground-reaction force vectors against Sho'Nuff's Red Glow guard.
   - **Mechanic:** Calibrate the 5 biomechanical links from heel plant to knuckle rotation so the strike lands with zero wrist buckle.
6. **Shaolin Wooden Dummy (`Muk Yan Jong`) 6-Gate Trap Puzzle:**
   - **Imagen Art:** Top-down + isometric blueprint of a brass-pinned wooden dummy with numbered upper/middle/lower arms and leg sweep peg.
   - **Mechanic:** Route a 6-beat wing-chun trap sequence where no two consecutive strikes use the same lead hand.
7. **Fight Doctor Cutman & Swelling Triage Chart:**
   - **Imagen Art:** Corner-stool medical anatomy board showing orbital swelling, split brow, bruised ribs, and adrenaline heart-rate monitor between rounds.
   - **Mechanic:** Apply the cold iron (enswell), adrenaline swab, and rib tape in strict 60-second corner-bell priority order.
8. **Breathing Cadence (`Qi / Prana`) Waveform Synchronizer (`Episode 07 · I Got the Glo`):**
   - **Imagen Art:** Oscilloscope + traditional brush-scroll breathing diagram contrasting Sho'Nuff's jagged red ragged breath with Leroy's harmonic gold sine wave.
   - **Mechanic:** Align the 5 inhalation/retention/exhalation beats to trigger the `12:57` gold impact frame.
9. **Broken Bracket Tamper-Log & Ring-Bell Timecode Audit (`Episode 05 · Break the Bracket`):**
   - **Imagen Art:** Cracked neon LED tournament scoreboard + ringside timekeeper's stopwatch log with torn yellow bout slips.
   - **Mechanic:** Reconstruct the real chronological order of the ambushed bouts by correcting the rigged ringside clock offsets.
10. **Master's Scroll Seal & Stance Cryptography (`Episode 08 · Legends Remain`):**
    - **Imagen Art:** Black-and-gold silk championship scroll stamped with 5 red hanko fist seals representing the 5 Dojo Grandmasters.
    - **Mechanic:** Place the 5 Grandmaster seals in tier order (`Chonk Lee → Dragonfly Jones → Franklin Duke → Bushedo Brown → Sho'Nuff`) to unlock the final dojo archive.

---

### II. Custom Movie Title Art & Fullscreen Cinema Polish (Items 11–14)
11. **Imagen Custom Title Cards for All 8 `Break the Bracket` Episodes:**
    - Generate grindhouse/anime title cards (`public/assets/kumite/titles/ep01-invitation.webp` .. `ep08-legends-remain.webp`) with bold hand-lettered kanji/brush + 1980s kung-fu cinema typography.
12. **Custom Title Cards for All 6 `Squabble House: The Last Waffle` Chapters:**
    - Replace plain text headers in `StoryMovie.tsx` with transparent-alpha SVG/WebP movie title lockups per episode.
13. **Auto-Hide Fullscreen Cinema HUD in `StoryMovie.tsx`:**
    - Fade out `.house-movie__hud-top` and `.house-movie__hud-bottom` after `2.2s` of pointer inactivity while the video is playing so `100%` of the `100vw × 100dvh` frame is pure unobstructed animation, re-appearing on tap/mouse move.
14. **Responsive Portrait (`9:16`) vs. Landscape (`16:9`) Auto-Source Switching in `StoryMovie.tsx`:**
    - Automatically bind `unlock-<slug>-portrait.mp4` on mobile portrait viewports (`window.innerWidth < window.innerHeight`) and `unlock-<slug>-landscape.mp4` on desktop/landscape viewports.

---

### III. Dojo Boss Raid Animated Enemy Sprites & Static Unplayable Boss Cards (Items 15–20)
*Currently, Precinct `Punch on Patrol` uses animated sprites for police NPCs (`boss-raid/motion-v2/*.webp`), while `Dojo Boss Raid` (`mode === "kumite"` in `BossRaidView.tsx` & `lib/squabblemon-engine/src/bossNpcCards.ts`) falls back to static card portraits for its lane minions and bosses.*

15. **Animated Sprite Sheets / Loops for All 5 Dojo Grandmaster Bosses (`BossIdleSprite.tsx`):**
    - Generate 6-frame breathing/combat-stance animated `.webp` sprite loops (`public/assets/boss-raid/dojo-motion/boss-tier-1..5.webp`) for **Chonk Lee**, **Dragonfly Jones**, **Franklin Duke**, **Bushedo Brown**, and **Sho'Nuff** in `BossIdleSprite.tsx`.
16. **Animated Sprite Loops for All Dojo Lane Enemy Minions (`.raid-npc` in `BossRaidView.tsx`):**
    - Generate transparent animated `.webp`/`.gif` sprites (`public/assets/boss-raid/dojo-motion/npc-*.webp`) for the Dojo Raid lane enemies so they animate on the dojo floor just like the Precinct units in Punch on Patrol.
17. **Hit-Stop, Knockback & Red/Gold Aura VFX on Dojo Boss Sprites:**
    - Wire attack-frame swaps (`idle` → `windup` → `strike` → `recoil`) on `.raid-npc` during the `BossRaidRoundBlast` sequence.
18. **Register Boss & Dojo NPCs as Static Unplayable Archive Cards (`Collection.tsx` & `CardInspector.tsx`):**
    - Expose `BOSS_NPCS` (`lib/squabblemon-engine/src/bossNpcCards.ts`) and the 5 Dojo Boss forms in a dedicated **"BOSS & DOJO ARCHIVE (UNPLAYABLE)"** tab/filter in `Collection.tsx` with a `BOSS THREAT · UNPLAYABLE IN PVP` badge so players can inspect their full art, lore, and abilities without allowing them into decks or packs (`bossRaid.test.ts` contract preserved).
19. **Defeat-Stamped Boss Collector Plaques:**
    - Track highest defeated tier per boss in `status.campaign` and stamp defeated unplayable Boss Cards in the Archive with a gold `DEFEATED · TIER X` seal.
20. **Dojo Boss Intro Cut-In Banner:**
    - Trigger a 1.2s full-width split-screen anime eye-catch (`VS SHO'NUFF · SHOGUN OF HARLEM`) when launching a Dojo Boss Raid run.

---

### IV. 3 Dynamic Squabble Forms per Kumite Fighter & Alternate Unlock Art (Items 21–25)
*Give every Kumite fighter (`leroy`, `shonuff`, `bushedo-brown`, `franklin-duke`, `dragonfly-jones`, `undercova-brotha`, `p-tang`, `chonk-lee`) **3 distinct artworks** (`24` total plates) that shift dynamically in battle and in the Dossier:*

21. **Form 01 — Base Dojo Stance (`assets/characters/<id>.webp`):**
    - Calm, orthodox/characteristic martial arts guard on initial deployment.
22. **Form 02 — Squabble Stance (`assets/characters/forms/<id>-squabble.webp`):**
    - Triggered dynamically in `CardView.tsx` / `Battle.tsx` / `BossRaidView.tsx` whenever the card is played with **SQUABBLE (2× Hands)** active — high-energy mid-strike pose with kinetic ink speedlines.
23. **Form 03 — Awakened Glo / Overdrive Form (`assets/characters/forms/<id>-awakened.webp`):**
    - Triggered dynamically whenever the card reaches **10+ Hands** (`isAwakened`) or triggers its signature special — full gold Glo / crimson Shogun bio-electric aura transformation (already previewable via the new 3-tab `.kumite-stance-tabs` switcher in `KumiteRewards.tsx`!).
24. **Unlockable Kumite Alternate Art Variants (`assets/cosmetics/<id>/kumite-alt-v1.webp`):**
    - Add an exclusive **Kumite Grandmaster Alternate Art** variant slot for each of the 8 Kumite fighters, unlocked by clearing their Dojo Boss Raid tier + winning a Weekly Bracket match with them in your crew.
25. **Live 3-Form Morph Transition in `CardView.tsx`:**
    - Cross-dissolve with a `320ms` gold/crimson radial flash when a Kumite fighter transitions from Form 01 → Form 02 (Squabble) → Form 03 (Awakened 10+ Hands) on the live board.

---

### V. Daily Kumite Boss Battle Reminders, Tournament Clock & Super-Layered Yellow/Black Roadmap (Items 26–30)
26. **Daily Login Reminder for Kumite Dojo Boss Battle (`DailyCheckInArrival.tsx` & `notificationCatalog.ts`):**
    - Add a daily check-in callout card & notification badge (`"DOJO BOSS RAID · 2 DAILY ENTRIES READY — Challenge the 5 Grandmasters to advance your Kumite unlock road"`) whenever the player logs in with remaining daily raid entries.
27. **Minimal Live Tournament Countdown Clock (`Kumite.tsx` & Safehouse Arcade/Kumite HUD):**
    - Shipped on `Kumite.tsx` (`.kumite-hub__clock`); extend to the Safehouse 3D Kumite trophy/poster hotspot tooltip so hovering shows `NEXT BRACKET LOCK · 04D 12H` in real time.
28. **Super-Layered Interactive Mission Nodes on the Yellow-and-Black Roadmap (`KumiteRewards.tsx`):**
    - Layer 1: Illustrated yellow-and-black asphalt/dojo scroll (`unlock-roadmap.webp`).
    - Layer 2: Animated SVG gold/dashed progress spine (`.kumite-roadmap__svg-spine`, shipped) + floating ember/ink particles.
    - Layer 3: Interactive mission pins showing both **Tournament Win path** AND **Dojo Boss Raid path** per node, with pulsing gold ring on `data-next="true"` (shipped).
29. **Inline Side-Quest Challenges on Roadmap Nodes:**
    - Add a mini mission checklist per roadmap node (e.g., *"Win 1 match with a 3-District sweep"*, *"Deal 35+ damage to a Tier 3+ Dojo Boss"*, *"Trigger Awakened 10+ Hands in Kumite"*) that grants bonus Style Shards alongside the fighter unlock.
30. **One-Click "Equip to Active Crew" & "Test Stance in Dojo" from Roadmap Dossier:**
    - Let players slot any unlocked Kumite fighter directly into their active 10-card crew or launch a 1-click Dojo practice round right from the `.kumite-dossier-preview` drawer on the yellow-and-black roadmap.
