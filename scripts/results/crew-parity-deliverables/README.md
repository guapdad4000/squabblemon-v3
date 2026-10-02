# Crips-first crew balance pass

## Status

Balance/rules 36 implements verified ability fixes and bounded buffs. **This is not evidence that every requested crew has reached parity.** Crips improved on every fresh confirmation seed but remains weak, particularly at base tier and under the greedy policy. Earth is essentially unchanged in these comparisons.

Nothing was pushed or published.

## Changes

- **Crips:** CLUE COOKY and LOOK OUT now receive their declared upgrades after a real successful trigger. INITIATION grants its recruit +2 base Hands and correctly applies its recipient upgrades, once per source; consumed, restored, or echoed marks cannot duplicate that training. Ganger Blue provides +3 remote support, or +4 for Blue Set. Blue-Nose Pit counts as Blue Set and trains on its first actual OG support, including delayed support.
- **Sherlock:** watches both other eligible districts with one shared cancellation. The +2/+2 reward, source-disable counterplay, own-district escape route, and expiry remain bounded. Watson is unchanged.
- **Plant:** OG Vegan grants its Plant ally +2 while retaining self +1. Matcha's low-Motion healthy-board fallback helps another local Plant. Spare Gus adds +1 to one remote Plant.
- **Earth:** Torta immediately Protects its paired Earth partner and pays +3 each at the existing eligible delayed settlement. Concrete's parcels grant Earth entrants +2, other entrants +1.
- **Dark:** Shotta's opening shot deals 3. Encore shots remain 2, with their existing per-round and per-match caps.

Printed costs and printed Hands are unchanged. The complete Air/Water reference kits, GUAP's game card, and all ten elemental in-hand bonus providers are unchanged. GUAP is excluded from the test rosters, not removed from the game.

## Fresh confirmation results

| Crew | Before score | After score | Change |
|---|---:|---:|---:|
| Crips | 26.74% | 34.72% | +7.99 percentage points |
| Sherlock | 54.25% | 59.07% | +4.82 percentage points |
| Plant | 59.20% | 62.76% | +3.56 percentage points |
| Dark | 67.27% | 68.79% | +1.52 percentage points |
| Earth | 64.58% | 64.80% | +0.22 percentage points |

Scores count a draw as half a point. They are fixed-roster bot scores, **not player win rates**, independent statistical samples, or causal estimates of individual card strength.

The initial calibration sample was more favorable to Crips: 38.11% to 51.04%. Its fresh confirmation result must not be replaced with that more flattering number. On confirmation, Crips' base-tier score was 29.69%, upgraded score 39.76%, greedy score 21.09%, and seeded-legal score 48.35%.

### Method

- Original 37 ordered rosters, IDs, order keys, canonical A/B roles, and original GUAP substitutions preserved.
- Greedy and seeded-legal policies; base and fully upgraded tiers; both seats; rotation zero; SQUABBLE enabled.
- Candidate frozen before confirmation outcomes were opened. No gameplay or hash-bound runner changes after that freeze.
- Four predeclared fresh seed labels; 5,440 unique cases per version, 10,880 fresh confirmation matches, 1,152 appearances per target crew per version.
- 2,720 additional new calibration matches compared with existing historical control results: 13,600 newly simulated matches total.
- Zero simulation failures. Target-vs-target pairs run once, not duplicated in the schedule.
- Shared 32 non-target opponents are separated from the other four target crews in the exports. This is not a new full-field 37-crew ranking.
- District seed labels do not guarantee distinct district layouts or statistically independent outcomes.

## Files

- `scores.csv`: calibration and confirmation, each separated into all opponents, 32 shared non-target opponents, and mutual target matches.
- `breakdowns.csv`: tier, policy, seat, seed, and opponent splits.
- `paired-matches.csv`: 8,160 exact-key before/after pairs across both comparison blocks.
- `manifest.json`: source fingerprints, row counts, and CSV checksums.

Raw immutable plans, worker records, source archives, harness copies, and paired JSON reports remain in sibling `crew-parity-*` results directories. CSVs were derived separately; the frozen harness and evidence were not rewritten.

## Verification

- Workspace TypeScript checks passed.
- The 25 new crew regressions passed and are included in the frontend test command.
- Full initial frontend run: 1,406/1,416 passed. Seven failures were outdated expectations for this patch. All five affected test files passed on rerun: 173/173. The remaining three failures are unrelated and reproduce against v35.
- Existing targeted Earth/Dark/creative suites: 332 passed. Triple OG suite: 12 passed. Trailing balance/tempo suites: 8 passed. Entry-bundle checks: 5 passed.
- Historical/new harness guard checks: 15 passed.
- Canonical staging Netlify release build passed, including bundled API smoke checks and the frontend bundle budget. No production database migration or deployment was performed.
- Additional online checks: 19 passed, one database-backed integration test skipped because DATABASE_URL was intentionally unset. Additional server input/authorization/seed/deck guards: 9 passed.
- Guest preview visually checked at 402×874. Signed-in collection UI was not browser-tested.
- API and web preview workflows restored after a duplicate-listener startup.

### Known pre-existing test failures left unchanged

1. `dinerCounters.test.ts`: old Griddle expectation says 2 damage; v35 already deals 3.
2. `matchTranscript.test.ts`: old assertion requires three aftermath lines; the unchanged authored scene contains two.
3. `matchTranscript.test.ts`: old story version assertion expects 10; the unchanged story version is 11.
4. `challengeApiRoutes.test.ts`: order-sensitive source regex expects the participant declaration after `xp: 0`; unchanged source declares it before.

The two story failures were reproduced with frozen v35 TypeScript and byte-verified unchanged HEAD JSON; those two JSON files were not included in the original v35 source archive. This limitation does not turn the reproduction into a wholly frozen-JSON test.