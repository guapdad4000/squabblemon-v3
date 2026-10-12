# Five-game refinement review

Local implementation, October 10, 2026. Punch on Patrol remains the visual reference. All new emblems use fists.

| Game | Pass 1: composition | Pass 2: gameplay clarity | Pass 3: feedback | Pass 4: progression/rewards | Pass 5: responsive verification |
| --- | --- | --- | --- | --- | --- |
| Girl Fade | Full-width ring, angled fighter selection | Bout objective and opposite-direction counter guidance | Confirmed health trail, damage/heal numbers, local flash; retained action sprites and impact overlays | 3/6-win ticket milestones, banked Clout, fist prize receipt | Desktop/phone counters, pause, retry, resume, completion |
| Fade Market | Full-width illustrated market | Five aisle alerts and explicit rapid/freeze durations | Integrity trail, selected restock feedback, north-facing punch sprites retained | Wave 3/6 ticket milestones and enlarged saved reward receipt | Desktop/phone powerups, pause, retry, resume, completion |
| Block Takeover | Full map with readable district hierarchy | Legal routes, six-district HQ gate, raid and attack guidance | Reachable outlines, incoming raid emphasis, crew health changes | Turf progress and banked reward receipt | Desktop/phone raids, controls, completion |
| Waffle Run | Pixel diner and battle presentation retained | Floor, enemy intent and active shield/dodge/boost/poison cues | Health trail and damage/heal numbers; plate transforms protected from button effects | 12/30-waffle tickets and large transparent prize art | Desktop/phone combat, move choice, retry, resume, death receipt, two daily entries |
| Stockz | Full-page exchange with new illustrated background | Five-call cap and explicit payout/risk objective | Larger host, selected choice feedback and reduced motion | Net trade receipt with fist prize art | Desktop, phone and short phone saved-error recovery, close/reopen, settlement |

## Validation

- Frontend TypeScript: passed.
- 15 engine/UI tests: passed.
- Arcade browser suite: passed at 1440 and 390 pixels.
- Waffle minigame browser suite: passed at 1440 and 390 pixels. MINIGAME_ONLY skips the unrelated older John Henry roadmap UI check; no claim of roadmap browser verification.
- Stockz browser suite: passed desktop, phone, short phone, including reduced motion.
- Production build: passed; existing chunk-size warning remains.
- Entry budgets passed: public 212.5/475 KiB; GameApp 876.5/900 KiB; Home 950.1/1200 KiB.
- Reviewed final game compositions and phone controls; receipts contain prize art without cropping.
- No reward economy or authoritative gameplay rules changed. No production deployment or publication performed.

Generated assets: stockz-exchange.webp and transparent banked-fist.webp under public/assets/minigames/polish-v2. Existing approved fighter and opponent art retained. Shared feedback follows reduced-motion preferences and uses labeled progressbars and keyboard focus.

Screenshots in this folder show each game at desktop and phone sizes. These are local automated test accounts, not production reward grants. AAA quality is a creative target, not a certification established by these checks.
