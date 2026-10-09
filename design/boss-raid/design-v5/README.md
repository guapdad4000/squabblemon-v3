# Boss raid: five design passes

Compared against the populated regular battle fixture at 390 × 844 and 1440 × 1000. Baseline and reference captures are in `screenshots/boss-raid-design/pass-0`.

| Pass | Problem | Completed change |
| --- | --- | --- |
| 1: Readability | 7–9px captions disappeared into wallpaper | Larger 10–14px HUD and ability copy, 19–34px scores, dark text scrims and stronger gold/cyan contrast |
| 2: Selection | Every lane looked the same; tapping a lane immediately spent the card | Separate playable, blocked and selected lanes, gold perimeter and corner brackets, explicit Play Card confirmation and Cancel |
| 3: Composition | Hand and ability copy covered lane actions | Reserved selection space and normal-flow hand dock, distinct boss stage and responsive field height, generated continuous precinct forecourt |
| 4: Custom assets | Generic card backs and ambiguous targeting | Original fist card-back SVG, target-reticle SVG and selected-card aiming geometry; grounded character shadows |
| 5: Responsive polish | Crowded NPC labels and inconsistent mobile targets | Readable NPC name plates, scrollable crowded board regions, retained 54px phone board cards and 96px hand cards, keyboard focus and 44px action targets |

The regular battle comparison informed the native gold action buttons, cyan opponent/gold player scores, printed card treatment and actual selected-card aiming origin. The raid retains its own precinct environment and persistent boss life display.

## Custom art

- `precinct-arena-master.png`: imagegen master, 1536 × 1024.
- `art-provenance.json`: reference, generation prompt and output provenance.
- Runtime arena WebP: 473,978 bytes; loaded only with the raid.
- `public/assets/boss-raid/precinct-cardback.svg` and `lane-reticle.svg`: original native vector UI assets.
- Existing Officer Oink identity and all five animated tier forms retained.

## Verified

- Six-round native matches at 1440×1000, 390×844, 360×640 with reduced motion, 768×1024 and 1024×768. Each completed six rounds and nine legal player plays, producing the unchanged 207-damage fixture result.
- Design interaction checks at 360×640, 390×844, 768×1024, 1024×768, 1440×1000 and 1920×1080: one selected lane, no document layout shift on selection, measured card-origin aiming, no hand/field overlap, keyboard deployment, no horizontal overflow and no browser or raid-asset errors.
- All five tier sprites advance frames, pause during dialogs and offscreen, and stay still with reduced motion. Boss portrait and title do not overlap.
- Workspace TypeScript passed. Release gate: 369 tests passed, one intentional skip; frontend/API builds and bundle budgets passed. Focused raid rules: 14 tests passed.
- Screenshots: `screenshots/boss-raid-design/final`; full match captures: `screenshots/boss-raid-design/pass-5`; sprite evidence: `screenshots/boss-raid-design/motion-final`.

Short phone and landscape screens may scroll vertically to preserve readable cards. Crowded lane regions scroll independently. No new permanent React animation loop: the aiming line measures on selection, resize and scroll, with one bounded settling update. Gameplay, six-round damage, daily limits and tier HP were not retuned.

Local preview only. This design pass was not committed, pushed or deployed.

## Follow-up: compact HUD and animated boss life

Moved the mobile command area upward approximately 50px by reducing the boss stage from 153px to 118px, the turn prompt from 40px to 28px and the police deck row from 28px to 24px. Added that space to the card field; lane selection still reserves fixed space and does not shift the board.

Health now stays at the previous round value during police reveal, then drains on the actual blast impact. The live crimson fill drains first; a gold damage trail follows with a 450ms delay. A composite-only highlight sweep and brief impact flash provide motion without a React frame loop. Dialogs pause the highlight; reduced motion disables health animations and transitions.

Browser verification measured 1200 → 1179 HP, live width 350.33px versus trailing width 355.89px mid-impact, correct final persisted health, dialog pause and reduced-motion stillness. Six-size layout and targeting checks passed again. Screenshot: `screenshots/boss-raid-hp-polish/phone-hp-impact.png`.

## Police entrance action banners and compact counters

Each actual police deployment now appears in a separate action banner with its existing animated sprite, name, destination lane and first effect sentence. The banner lasts 900ms; the round blast waits until all entrances have finished. Native board snapshots still follow the exact legal play order. Both timers share `bossRaidPresentation.ts` so the replay cannot cut off additional police cards. Reduced motion keeps the banner still.

The separate precinct hand strip was removed. The boss stage now shows a red minus-number for total damage on the left and a gold remaining-deck count on the right. The life bar retains its HP readout. Damage and health change together at impact, after police deployment. The compact turn/result message has no container background.

`e2e/verify-boss-entrances.mjs` verified successive Police Hound and Corrupt Judge entrances against the actual round record, large sprite bounds, effect/name text, banner dismissal, removal of the old deck row, and final damage counter state. Screenshots live in `screenshots/boss-raid-police-entrances`.

## Cinematic launch, centered results and physical lane strikes

The launch uses a new transparent Officer Oink splash pose generated from the actual collectible identity, preserving the white cap, green aviators, blue uniform and gold accessories. The 288,624-byte WebP ships only with the raid. The full master and generation provenance are saved alongside this review. The phone layout keeps the full pose above the explanatory copy; desktop uses a large two-column encounter poster. The existing `CompactDeckPicker` replaces the native select. The gold Fight button has a clipped game frame and composite highlight animation.

The Back to Fadecade action now lives in a centered Radix result dialog that opens only after the final police sequence and boss strike finish. It shows persisted damage, remaining HP and ticket rewards. Review Battlefield closes it and restores keyboard focus to View Results. Idle sprites and the HP highlight pause behind the popup.

`BossRaidRoundBlast` measures actual crew-card centers and the boss portrait once, with resize observation and cleanup. Successful lane attacks charge, send gold-core/cyan-aura beams into Oink, then emit an expanding shockwave and twelve radial sparks. Damage text stays anchored to the boss. Reduced motion suppresses movement and added particles. No permanent React frame loop, and no gameplay damage or cost changes.

Launch checks passed at 360×640, 390×844, 768×1024, 1024×768, 1440×1000 and 1920×1080: native deck selected, Fight enters the game, no horizontal overflow and no browser/asset errors. Full six-round journeys produced the same 207 fixture damage on desktop, phone, reduced-motion short phone and both iPad orientations. Release gate passed with 369 tests, one intentional skip, successful builds and unchanged shared bundle budgets. Screenshots: `screenshots/boss-raid-epic/entry` and `screenshots/boss-raid-epic/matches`. Still local and unpublished.

## Results art and police dossiers (v6)
- Draw count now occupies the left boss counter; cumulative damage occupies the right.
- Police inspection uses the normal CardInspector portrait and battle dossier, with live Hands, statuses, and effect text. Explicit BOSS_NPCS membership allows boss-only gold finish and precinct labeling without adding enemies to the catalog or packs.
- Police portrait files are intact first frames from existing idle sheets; Officer Oink uses his original collectible portrait.
- Generated attack-complete-bg.webp from exec-88ccdaed-6303-49d1-8448-161fa36e9c8c.png: dark precinct aftermath, cyan electricity and gold sparks, uncluttered center. Custom SVG fist reward seal; no crowns. Display and mono font families match the game's arcade typography.
- Five full six-round journeys passed, including counter ordering, normal police dossier, and centered results. All produced 207 damage. TypeScript and frontend build/bundle budgets passed.
