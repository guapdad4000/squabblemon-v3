# Beta hardening and current-game evidence — October 25, 2026

This is a local working-tree candidate based on `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`, branch `codex/v2-performance-api`. It implements the four accepted follow-up passes: current-rule CPU/testing, safe version retirement and release safeguards, player-flow QA, and a fresh balance assessment. It is not a deployment or a claim that every item in the original architecture backlog is closed. No push or deployment was performed.

## What changed

- **Current-game choices:** live CPU, simulation and paid-action adapters share legal investments and eligible Squabble choices. Exact paid intent survives execution. Gamer no longer receives its obsolete cheap-card setup bonus. The evaluator considers planted KYLE fuses and the actual round horizon. CPU preview branches omit presentation-only snapshots and mask private opponent/future draw information.
- **Safe updates:** rules/card compatibility version 64 retires incompatible online rooms before bot moves, clocks, commands or settlement. Unfinished Kumite brackets cancel neutrally, preserving completed history and existing receipts. Stale PvE checkpoints/completions return a typed 409. The Road can replace exactly one incompatible unfinished encounter under the existing run/entry locks, with no second purchase. Recovery loads fresh application code; focus moves to its heading. Ordinary transient failures retain their saved transcript and retry flow.
- **One release gate:** local frontend and Netlify builds share required source tests, Story music validation, Vite, JS budgets and emitted CSS/panel guards. Skipped/todo/empty required tests and source changes during verification fail the gate. Additional native, browser and manual tiers remain explicitly inventoried rather than silently inferred from a build.
- **Current guidance and onboarding:** deck guidance and stale rule assertions use the current catalog. Dr. Fade's welcome promises derive from his live 3 Motion / 5 Hands / 10 base Squabble values. Five old spoken stat takes are excluded instead of relabeled; other voice cues remain. Boot artwork resolves correctly under root and subpath deployments. The coached journey follows the current 15-lesson tour, selected recruit and actual failed-save/retry boundary. A late saved-battle account update now opens its receipt without overriding a deliberate return to the setup lesson.
- **Campaign test solver:** canonical legal investments and Squabble options replace strongest-card-only pruning. Branch identity includes active traps and the gameplay event sequence. Per-solve transition reuse and a general district-control scoring alternative find legal lines without raising the 10-second / 40,000-expansion limits. This is a bounded QA search, not proof that every legal plan is explored.
- **Responsive recovery:** mobile banner arrow hit regions are 44px and constrained inside the viewport. The reproduced 2px horizontal overflow is fixed without clipping the artwork. Online recovery explicitly loads its existing social button styles and uses a compact closed-room layout over the preserved alley backdrop. PvE recovery is reachable at 320px width and short landscape.

Card costs, Hands, effects, authored training tiers and player records were not rebalanced from simulation scores. No artwork or established visual material was removed.

## Fresh named deck evidence

The [v64 report](../../artifacts/deliverables/current-deck-audit-20261025-v64/README.md) contains 46 exact ten-card recipes with all 460 card names, the 301-card catalog snapshot, policy/seat splits and matchups. **20,368 scheduled matches passed: 17,296 league, 2,816 stress, 256 independent confirmation; zero failed cases.** All 301 cards were observed without forced supplemental matches. Another 276 full-event/compact complete-match comparison pairs passed separately. Raw worker hashes, partitions and aggregates were independently verified during export.

KYLE was played in 346/752 league appearances after the policy fix, versus 0 in the earlier v63 sample. Light remains the top diagnostic concern at 78.39%; Air follows at 71.94%. Seeds and policies changed between runs, so these are not causal before/after estimates or human win rates. The [balance review](../../artifacts/deliverables/current-deck-audit-20261025-v64/BALANCE-REVIEW.md) defines counterplay tests for Light, Music/Community sequencing, Fire/KYLE and deliberately held/triggered duo lines. It does not recommend speculative numerical buffs or nerfs.

The frozen simulation source hash is `dfbfacef31b2fe22c0cfb012f0b0013b8b32fb66c4df325c138f320b25956a5b`, policy `online-base-shared-legal-delayed-horizon-v3`. The archived 102-file manifest, source archive checksum and raw/derived evidence are retained. Historical v63 and older reports remain historical, indexed in [current evidence](../balance/README.md).

## Executed validation

The retained [evidence directory](../../artifacts/deliverables/beta-hardening-20261025/) separates successful scopes from failed attempts. Commands, environments and limitations accompany the [CPU checks](../../artifacts/deliverables/beta-hardening-20261025/cpu-policy/README.md) and [native retirement checks](../../artifacts/deliverables/beta-hardening-20261025/online-retirement/README.md).

| Scope | Result | Meaning |
| --- | --- | --- |
| CPU/evaluator focused checks | 7/7 passed | Exact legal paid/Squabble choices, hidden data invariance, KYLE/horizon behavior |
| Sweep/rivalry checks | 24/24 passed | Exact paid second ply and adapter choices; current harness validation |
| Full engine and balanceLab files | Both passed | File-level TAP only; no invented individual-case total |
| Current roster/version assertions | 137/137 passed | Current definitions and compatibility assertions |
| Battle UI and rules-error classification | 84/84 passed | Rendering contracts and specific 409 versus transient failure behavior |
| Native retirement/reward HTTP | 19/19 passed | Fresh PostgreSQL; locked concurrent challenge resume and no duplicate spend/settlement |
| Native ranked/online | 15/15 passed | Current-rule settlement, retries and receipt preservation |
| Kumite integration / pure lifecycle | 17/17 and 30/30 passed | Embedded service and pure engine coverage; distinct from native locking proof |
| Native social / lobby | 35/35 passed | Fresh PostgreSQL; authorization, independent connections and current online integration |
| Native feedback / patches | 12/12 passed | Plus 8 applied-history fixtures, 9 forward migrations, rollback/retry/schema reconciliation |
| Final embedded API tier | 365/365 passed | Zero failures/skips/cancellations; complete campaign included; native tiers reported separately |
| Native flexible pulls | 47/47 passed | Exact purchase intent, retry, rollback and shared wallet |
| Native monthly login | 13/13 passed | Calendar/reward persistence and idempotency |
| Native payments | 23/23 passed | Local provider/fulfillment transaction tests; no live payments |
| Native style-shard purchases | 4/4 passed | Updated seasonal milestone accounting and receipt replay |
| Purchase recovery browser | 9 scenarios passed | Real components with mocked HTTP, narrow phone overflow and retry/account cases |
| Story reward browser | Passed | 8-chapter reward/catchup/retry scenarios, receipt/animation/reduced-motion and short-phone bounds |
| PvE rules recovery browser | Checkpoint and completion passed | Real PlayLoop, verified completed transcript, actual reload, same challenge request and four viewport sizes |
| Online rules recovery browser | 4/4 passed | Friend, ranked and Kumite; focus survives polling, 44px controls, no overflow, correct full navigation |
| Full rookie journey browser | Phone and desktop passed | 15 lessons, failed-save retry, actual verified battle, late receipt, reload and exactly one claim |
| Deck journey browser | 10/10 passed | Desktop/phone save/discard/stay/history, no unexpected API/resource/JS failures |
| Campaign HTTP and solver | 13/13 passed | Fresh embedded database; full new-account progression, receipt/cross-account checks and both prior solver failures, unchanged limits |
| Focused campaign solver | 12/12 passed | Legal replay, utility Squabble, trap and gameplay-seed identity |
| Final frontend and API TypeScript | Passed | Local source types; no hosted execution implied |
| Shared production release gate | 209/209 tests and build passed | No failures/skips/todos; Story metadata, bundle budgets and emitted CSS/panel checks passed |
| Report integrity | 16/16 passed | Synthetic corruption and format guards; not balance proof |

The PvE recovery fixture reloads the actual PlayLoop with the same challenge ID, but it does not execute the complete FlagshipMachine reopening route. The `machine=road` reopening path was source-inspected; the locked server resume was independently tested natively. Neither is a real two-client network or authenticated staging session.

All listed final local checks passed. Test scopes overlap, so their counts are not added into a misleading unique-test total. The final build identity and budget results are recorded below.

## Failed attempts and their disposition

The first broad embedded database run ended 373 passed / 6 failed / 1 skipped; it is retained as a failed attempt. A stale style-shard expectation missed the existing seasonal milestone ticket bonus: 20 − 10 + 1 = 11 tickets. The corrected test also verifies 60 pack slots, milestone 5/10 receipts and retry replay, and passed 4/4 against native PostgreSQL. A missing retirement test path came from renaming its native-only file after that run had enumerated files. Ranked native ownership and flexible-pull native concurrency were incorrectly included in the generic embedded harness; event-feedback also raised an embedded protocol error. Explicit native suite dispatch and required native commands replace that ambiguity; none of these failures is asserted to be pre-existing without a baseline.

Two campaign solver cases also failed a dedicated isolated run, proving CPU contention was not the sole cause. The solver had stale strongest-card-only Squabble pruning and an incomplete state key. Canonical legal choices, complete mutable-state identity (including traps and gameplay event sequence), per-solve transition reuse and a general district-control alternative corrected the stale search. Focused 12/12 and full campaign 13/13 checks passed with unchanged limits. Failed 10s / 40k-budget attempts remain in the evidence. A search failure alone does not prove an encounter unwinnable; the solver remains bounded to four searched player actions per turn and its initial round horizon.

The final frozen-source embedded rerun passed 365/365 with zero failures, cancellations, skips or todos in 553.8 seconds. The separately required native feedback suite passed 12/12 and native social passed 35/35. This resolves the local dispositions above without reclassifying any failed attempt as successful.

## Still required before a production release decision

- Authenticated staging sign-in through battle, reward, revisit and interrupted network; real two-client update/reconnect cases.
- A connected physical phone/tablet, touch/keyboard/text-enlargement/screen-reader testing, and the intended reduced-motion combinations. No physical phone was connected during this pass.
- Human crossed-seat playtests for the specific balance targets. Automated coverage is not proof of player balance or optimized-deck strength.
- Complete hosting release/rollback verification against an actual ready revision. Local builds do not establish deployed health or latency.
- The remaining scoped accessibility, API schema/observability and measured performance items in the [dated architecture audit](architecture-beta-2026-10-24.md) remain an explicit backlog; they were not all part of these four follow-up passes.

No schema change was introduced by the retirement/cancellation metadata. The new inventory still requires native migration execution/replay for future SQL/schema changes. No performance claim is made from browser fixture timing; the CPU decision timing in its report is a local microbenchmark only.

## Final verification addendum

Frontend typechecking passed with no diagnostics. The shared production build passed all **209 required source tests**, current Story music metadata, Vite compilation, existing entry budgets and emitted CSS/panel guards. It inspected 50 stylesheets, 5 panel combinations, 2 paper variants and 9 consistent panel rules.

| Emitted static JavaScript scope | Measured | Existing limit |
| --- | ---: | ---: |
| Public entry | 211.5 KiB | 475 KiB |
| GameApp | 650.7 KiB | 900 KiB |
| Home | 956.1 KiB | 1,200 KiB |

Vite still emits its generic advisory for the 575.14 kB Story chunk; all enforced project budgets passed unchanged. This is bundle-size evidence, not a device frame-rate or network-latency claim. The reduced-motion online recovery fixture also emitted a development warning for the externally served Three.js module; its static alley cases had no browser errors and do not verify optional WebGL rendering.

The [final build record](../../artifacts/deliverables/beta-hardening-20261025/release-gates/shared-production-build.json) verified at `2026-10-25T08:35:14.176Z` binds base commit `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2` to tracked-diff SHA-256 `4169d75cf3bd084c0641f45d822ac9330e7f4549205e5b2ea81f103d18226544`, untracked source hashes and critical input hashes. Its before/after identity was stable and rechecked during evidence retention. A patch and hashed new source archive accompany the evidence; the base commit alone is not this uncommitted candidate.

All three v64 simulation datasets were checked again after the build and remained current with source hash `dfbfacef31b2fe22c0cfb012f0b0013b8b32fb66c4df325c138f320b25956a5b`. Final `git diff --check` passed. All temporary browsers, servers and owned databases created for these checks were closed; existing user previews were preserved.

The [verification summary](../../artifacts/deliverables/beta-hardening-20261025/verification.json) and [evidence hashes](../../artifacts/deliverables/beta-hardening-20261025/evidence-sha256.json) retain exact scope. No commit, push, deployment or live database operation was performed.
