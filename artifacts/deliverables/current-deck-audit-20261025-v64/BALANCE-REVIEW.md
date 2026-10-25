# Read-only balance interpretation — completed v63/v64 comparison

No runtime or frozen-source changes were made for this audit. No numerical card change is justified by the available automated ranks alone. Current canonical card cost/power/effect snapshots and all ordered league rosters are identical between the v63 and v64 plans. The schedule shape is also identical, but the seed namespaces differ. v64 additionally changes policy evaluation and legal-choice integration; its score shifts cannot be attributed to one policy fix independently of seeds.

## Priority concerns and concrete playtests

1. **Light: protection, cleanse and low-cost pressure reinforce each other.** v63 score80.78%, greedy80.85%, chain-two80.72%; first seat84.57%, other seat76.99%. This is the most policy-stable outlier. Current canonical values include Yasuke2Motion/3Hands with ally+2/Protection/enemy-2, Dr.Fade3/5 with enemy-2 and remote ally+2, Foodz3/3 with whole-board cleanse and up to three ally+2, plus Church/Medic once-round reactions and Abuela's in-hand Light growth. These are authored effects, not an identified infinite loop. Test Light against Dark's silence/bonus removal, Fire/KYLE timed damage, TOUR MONEY and EVERYBODY EATS. Cross seats and players; record whether removal/denial can actually break the engine, successful shield blocks, cleansed statuses, Abuela-held rounds, and round-by-round district lead. Only after pilots and paired engine counterfactuals should one isolate a particular cap/cost; avoid flattening every Light card.

2. **TOUR MONEY: successful-entrance engine plus wide payoff.** v63 score72.01%; greedy69.55%, chain-two74.47%; seat80.98% versus63.03%. Rapper can attempt3 damage locally and grant3 Hands on another stage each round, using two distinct bounded ledgers. Hype's cross-lane response grants+3/+3 and Protection; One-Man Band can grant+3 to one Music ally in each district once per match and has two bounded held-hand payouts. Merch discount is capped twice, Soundcheck once and DJ once; no unbounded loop found in this read. Test denial before Rapper setup, disabling Hype/caller, DJ after the caps are spent, and movement Lock versus Van/Mixtape. Record actual successful entrances and payout ledgers, not just final Hands. Large first-seat spread merits sequencing/initiative review before damage or cost nerfs.

3. **EVERYBODY EATS: unconditional floor and protected wide payout.** v63 score70.21%; greedy72.74%, chain-two67.69%; seat80.98% versus59.44%. Current Cook is2Motion/4Hands; healthy eligible Homeless recipient gets+3 then+2, cleanse and Protection, once per recipient. Foodz's three-district base buff can stack with once-per-side Homeless servings: with existing eligible allies in all three districts, up to+12 distributed allied Hands plus three Protection grants and its own3Hands. This ceiling requires a prepared board; do not compare it to a naked card's printed value. Test spread versus forced concentration, damage versus bonus trimming, early Cook versus saving its one meal, and Foodz denial/return while serving is spent. Inspect whether counters create real tradeoffs rather than merely feeding recovery.

4. **Low pairs: separate recipe weakness from a missing future-value policy.** Demario/Luigion26.53% versus Mushroom Garden54.92% uses the same pair in two shells. Demario's round-start Mushrooms require keeping him in hand, which the immediate/own-next-play search does not value explicitly. Sherlock/Watson21.94% versus Investigations38.90% similarly does not isolate those cards; Sherlock's public stakeout depends on the opponent's next entrance, while the chain evaluator searches only the acting owner's next play. v63 Sherlock was deployed in49.8% of its1,504 roster appearances, while Watson was98.7%; this is a deployment symptom, not proof Sherlock is weak. Test intentional hold-Demario lines, Mushroom placement/consumption and Powered Luigion routing; test Sherlock before a valuable enemy entrance, bait with a cheap entrance, and Watson after Sherlock. Compare current shells using the same draw/district seeds, then compare a human-selected line against the bot's line. Prefer policy/guidance/recipe corrections before card buffs.

5. **Counterplay Legacy is a historical comparator.**16.76% versus coherent Dark Control38.03% and Dark68.28% does not justify broad buffs to its shared cards. The legacy six-character shell is completed with four support cards; it is explicitly retained for historical rule-only comparison. Keep its label clear, and use the coherent/current shell for recommendations. Compare actionable hostile effects blocked by Protection, dead supports, turn sequencing and ability targets before changing raw Hands.

## Evidence gaps

- The league is46 fixed base-card recipes, not optimized deck search, upgraded-card balance, live PvP/Story CPU performance or player skill. All301 cards being observed played establishes deployment coverage, not every legal interaction or successful ability branch.
- v63 overall opening-seat score was59.57%. Mirrored seats improve comparison, but the same recipe can still depend strongly on opening tempo. Report each seat and policy rather than just tier.
- Greedy/chain-two use immediate public board value; chain-two considers only the top four immediate candidates and one extra own play. It does not solve the rival response or most hand-held/triggered future payoffs. v64 fixes KYLE fuses, the extended-round resource horizon and legal paid options, not all delayed mechanics.
- Ability-event totals include direct, nested and unknown attribution; a played card or emitted event is not a causal contribution estimate. Add decision traces/hold duration/blocked or successful triggers to targeted investigations; do not interpret the aggregate final-copy power as card win contribution.
- Before a numerical change, run a small crossed-seat/player exploratory set for each target matchup (for example four games per seat), then use a preregistered larger follow-up and same-seed engine counterfactuals on the specific mechanism. A small pilot or arbitrary tier threshold alone is not a release nerf/buff criterion.
- A concrete rule violation, uncapped loop despite an authored cap, incorrect payment or impossible targeting can justify a correctness fix without human balance testing. This read-only audit found no such new confirmed defect. A stale fourCrewAuthority test asserting v63 was reported to the compatibility owner; it is test maintenance, not balance evidence.

## Source pointers

- Canonical override order: lib/squabblemon-engine/src/data.ts:300–305; final cost/power table: basePvpBalance.ts:3. Inspect the final catalog rather than only earlier declaration literals.
- Light held growth: gameEngine.ts:1324; Church/Medic reaction gating:1090–1107; Foodz whole-board/serving:4870–4891; Abuela actual-damage recovery:creativeReworks.ts:989.
- Music caps and reactive output: musicIndustryAbilities.ts:212–222,237–261; selectedAbilities.ts:268–286,621–623,630 onward; definitions musicIndustryWave.ts:5–14 and selectedWave.ts:316.
- Cook meal ledger: selectedAbilities.ts:316–339.
- Sherlock pair: gameEngine.ts:2841–2868 and5422–5447; Demario held spawn:5624–5646; Luigion Mushroom/route:3691 onward.
- Explicit legacy shell: balanceLab.ts:1169–1181; current evaluation:485–534; bounded chain search:fullBalanceSweepCore.ts:170–191; base-only assertion:155–160.

## v64 comparison

Stress is complete:2,816/2,816 successful, zero failures, source `dfbfacef31b2fe22c0cfb012f0b0013b8b32fb66c4df325c138f320b25956a5b`, policy `online-base-shared-legal-delayed-horizon-v3`. All82 catalog-probe targets were observed played. Concert choices0/1 appeared42/54 times; Dice canonical wager choices0(=1)/2/3 appeared52/27/12; Homeless Guy investment0/1/2/3/4 appeared27/10/3/8/16. These exercise legal choices; they do not establish every choice is tactically good or its reward is balanced. Matrix results are compared below.


Matrix is complete: **17,296/17,296 successful, zero failures**. Matrix plus stress observed **301/301** collectible cards played, with no supplemental forced KYLE case needed. This audit checked summary status/counts and plan/source identity; parent owns raw-worker checksums and final report validation. Both versions have752 league appearances per recipe.

| Recipe | v63 score | v64 score | Difference (pp) | v64 first / other seat |
|---|---:|---:|---:|---:|
| Light | 80.78% | 78.39% | -2.39 | 85.51% / 71.28% |
| TOUR MONEY | 72.01% | 69.15% | -2.86 | 79.52% / 58.78% |
| EVERYBODY EATS | 70.21% | 67.82% | -2.39 | 80.05% / 55.59% |
| Demario and Luigion | 26.53% | 22.81% | -3.72 | 24.47% / 21.14% |
| Sherlock and Watson | 21.94% | 23.60% | +1.66 | 32.31% / 14.89% |
| Counterplay Legacy | 16.76% | 18.09% | +1.33 | 21.94% / 14.23% |
| Mushroom Garden | 54.92% | 58.31% | +3.39 | 66.89% / 49.73% |
| Dark Control | 38.03% | 34.97% | -3.06 | 47.21% / 22.74% |
| Investigations | 38.90% | 38.63% | -0.27 | 51.20% / 26.06% |
| Fire | 61.90% | 68.35% | +6.45 | 76.99% / 59.71% |
| Dark | 68.28% | 67.22% | -1.06 | 78.32% / 56.12% |
| Air | 66.62% | 71.94% | +5.32 | 81.52% / 62.37% |

These are **different-seed, different-policy diagnostic samples**, not causal before/after estimates. Catalog/ordered roster/schedule-shape equality is confirmed from both plans; seed namespaces differ (`base-pvp-b63-r63-refresh-20261025-validation-*` versus `base-pvp-b64-r64-beta-v64-corrected-validation-*`). Neither confidence bounds nor human win-rate claims are inferred.

- **Light remains the first playtest priority.** v64 greedy78.59% and chain-two78.19% are still nearly identical, and both seats exceed71%. Its decrease does not settle the protection/cleanse/value concern. Test the intended counter-decks and readable interaction windows before altering numbers.
- **Music and Community remain strong but initiative-sensitive.** TOUR MONEY's greedy66.09% versus chain-two72.21%, and EVERYBODY EATS'69.15% versus66.49%, show that more lookahead does not uniformly help. Their first/other-seat gaps are20.74pp and24.47pp. Check sequencing and setup disruption in crossed-seat human sets.
- **The low pairs remain unsuitable evidence for raw buffs.** Demario/Luigion22.81% versus Mushroom Garden58.31% is a35.51pp shell difference despite the same duo. Sherlock/Watson23.60% versus Investigations38.63% remains a14.03pp shell difference. Bot deployments were Demario1,502/1,504 and Sherlock802/1,504; getting played is not proof the right holding/denial line was selected. Compare deliberate human hold/bait lines and same-seed recipe changes first.
- **KYLE's missing-policy-value symptom is materially improved.** In the v63 league KYLE was played0/752 appearances; v64 played346/752 (46.01%), with1,702 direct effect events and no unknown event attribution. Fire's score rose61.90%→68.35%, but changed seeds and the rest of the policy corrections prevent assigning that6.45pp gain solely to KYLE. The next target is timing KYLE in occupied versus empty districts, against Protection and movement, including round6 with/without After Party—not a new buff.
- **Opening tempo remains an ecosystem issue to test.** Overall first-seat score is59.77% (v63:59.57%), even though initiative alternates by round. Mirroring controls reporting bias; it does not establish this remaining advantage is acceptable gameplay. In human tests, log early commitment, first Squabble, board population at round2 and final-round initiative.
- Air also rises66.62%→71.94% and now ranks second. Add it as a high-priority movement counterexample in the Light/Community sessions; do not focus only on yesterday's top three.

**Decision:** retain current numerical balance for this release-readiness pass. Prioritize Light counterplay, then Music/Community sequencing and Fire/KYLE timing; evaluate low pairs through intentional play and coherent shell comparisons. Correctness regressions can be fixed independently when demonstrated, but no new card-stat change is justified by these summaries alone. Parent's256-case confirmation is separate evidence and is not pooled into these league scores.
