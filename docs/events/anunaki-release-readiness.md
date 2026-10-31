# Anunaki release readiness — October 29, 2026

Production publication remains held. The verified batch is being integrated into draft Kumite PR #21 at the user's request. This report records local evidence, not a deployed release or physical-device approval.

## Completed in this readiness pass

| Check | Result | Scope |
| --- | --- | --- |
| Fresh account Story and progression | 18 native database tests passed | Authenticated test HTTP, all 56 nodes, 32 legal replay-verified wins, eight puzzles, roadmap claims, raid eligibility, persistence/retries and cosmetic transactions. Test authentication is injected; this is not a production sign-in session. |
| Media and cosmetic follow-up | 10 tests passed | Retained drawn cels, alpha exports, reaction ownership and cosmetic files. |
| Featured banner transactions | 72 tests passed | Disposable native PostgreSQL, odds/guarantee behavior, counters, contention, recovery and beta code. |
| Old/new browser compatibility | 14 tests passed | Real transport modules in isolated browsers against local API/PGlite; old ranked/friend access returns refresh-required 409, updated access works, legacy reactions filtered. Route tests separately cover full fade/reconnect/rematch. This is not two full app clients completing an Anunaki battle. |
| Anunaki combat/raid rules | 54 tests passed | Both seats, Caucus chain limits and shields, radiation lifetime, Yakub summon/echo/bounce behavior, Ninhursag, tablet discounts, raid resolution. |
| Animation files | 52/52 hashes match | Current public files checked against retained manifest; no missing media. |

The native test runner initially failed only in its media follow-up: its disposable copy excluded provenance documents and omitted the frontend JSX loader. It now links the read-only docs and uses the same loader as frontend tests. The complete corrected runner passed.

Evidence is retained in `output/anunaki-readiness-review/` beside this checkout. Existing responsive and animation screenshots remain in `output/raid-cinema-review/`; this pass changed no player-facing visuals.

## Balance finding

Update: the approved four-card tuning is now implemented. See [version 65 tuning results](anunaki-balance-tuning.md): 60.0% on the matched benchmark, 65.6% on fresh seeds. The findings below describe the pre-tuning baseline.

The original 64-game diagnostic returned 54 wins, eight losses and two draws. A separate 20-seed holdout returned **504 wins, 119 losses and 17 draws in 640 matches**. Both use base tier, eight authored opponent decks, two policies, both seats, rotation zero, Squabble enabled.

- Greedy policy: 281 wins / 31 losses / 8 draws.
- Seeded legal policy: 223 wins / 88 losses / 9 draws.
- First seat: 237 wins / 75 losses / 8 draws.
- Second seat: 267 wins / 44 losses / 9 draws.

This is a strong simulation imbalance signal, not a human win rate or a full current roster ranking. Fixed card order, limited opponents, policy choices and paid-choice coverage limit it. The small Standard raid diagnostic won two of three Anunaki card-order trials; it does not prove all raid difficulties balanced.

Keep the user's requested 2/3 Caucus, 2/1 Yakub, 3/3 Ereshkigal and 2/3 Ninhursag unchanged for now. No additional buffs. Before a tuning change, use matched-seed variants to isolate summon output, radiation growth, tablet economy and Ninhursag reactions; retain the baseline and compare seats/policies. Then play human-controlled matches against removal, protection, disruption and swarm decks. Avoid attributing the aggregate result to a single card without evidence.

Reproduce the holdout with `ANUNAKI_BALANCE_SEEDS=20 ANUNAKI_BALANCE_SEED_PREFIX=readiness-holdout node --import tsx src/anunaki-balance-smoke.ts` from `scripts/`. Raw outcomes and the exact original holdout runner are retained with the evidence.

## Release calendar and economy contract

1. Selected launch: November 2–16, 2026 at 00:00 UTC (November 1–15 at 4 PM Pacific), start inclusive/end exclusive. The source is configured; push remains held. First return: December 7–14 at 00:00 UTC (December 6–13 at 4 PM Pacific). Next: January 4–11, 2027 at 00:00 UTC (January 3–10 at 4 PM Pacific). If release slips past launch, reschedule the unpublished window before deploying rather than silently shortening it.
2. After launch, return for seven days beginning the first Monday at 00:00 UTC each month. A monthly window overlapping the launch is skipped. Show actual local start/end dates in the game; UTC Monday may be Sunday locally.
3. Keep the seven featured Anunaki characters out of normal pools. Yakub, Caucus and Anu remain roadmap rewards. Campaign progress and earned cosmetics remain permanent between banner windows.
4. Shared featured rule: 10% dedicated fifth slot, ten-pack guarantee, per-banner-family progress and unowned priority for the guarantee. Do not describe 10% as the chance for each individual card or each of five slots. Preserve exact pending occurrence/payment/count and receipts across expiry/retry.
5. Campaign plus optional roadmap totals remain 4,850 Clout and 14 tickets, before pack bonuses/monthly milestones. Review actual beta completion/pull behavior before changing this payout.
6. Enable `ANUNAKI_BETA_CODE_ENABLED=true` only in the authorized release configuration if the whole-deck tester code is wanted. `DEVANUNAKI` grants the ten playable cards once per account; generated summons are excluded.

## Remaining acceptance work

- Completed: two full app sessions with automated UI input against native PostgreSQL, desktop 1440×1000 and phone viewport 390×844. Both seats played Yakub, Caucus and Anu; observed a four-hit/three-extra Caucus chain, radiation and tablet consumption; rendered scores matched the server; reload restored the hand and board; both seats agreed on the final result. This uses injected test authentication, not production sign-in. Friend fades intentionally grant no farmable currency/XP; reward protection is covered separately by native route tests. Human playtesting remains useful for balance and usability.
- Actual phone: full Story-to-reward flow, raid hand/turn reachability, crowded formations, special playback, app background/resume, audio and reduced motion. Responsive desktop emulation is already available; physical hardware was not available in this session.
- Approved tuning implemented: 60.0% matched simulation and 65.6% fresh seeds. Keep human feedback and the seat split under review; no additional tuning is planned before beta feedback.
- On explicit release authorization: confirm the selected dates are still future, freeze source, rerun release gates, commit only intended scope, apply/verify migrations, deploy, verify matching ready revision, then verify live banner/Story/roadmap/raid claims and retry recovery. No production writes or deployment were performed here.

Raid power-ups remain a later gameplay feature with their contract in `shared-raid-cinema.md`; they are not part of this release-readiness pass.

## Selected launch states

- Before November 2 00:00 UTC: show upcoming Anunaki banner and opening time; reject new pulls.
- November 2 through November 16 00:00 UTC, end exclusive: featured pulls active.
- Between windows: show next return; seven banner fighters remain excluded from normal pools. Story, raid, roadmap, owned cards and earned cosmetics remain accessible.
- December 7–14 UTC and each later first-Monday week: featured pulls return with the same family guarantee progress.
- After any window closes: recover existing pending purchase receipts with their original occurrence; never reinterpret them as a new banner.

The new local two-browser command is `env -u DATABASE_URL node scripts/test-payments-database.mjs --anunaki-browser`. It owns and removes its native PostgreSQL cluster and test host. Screenshots and final report are in `output/anunaki-launch-review/` beside this checkout. Calendar/native-purchase checks: 73 passed.

## Physical phone handoff

On a real phone, verify sign-in, opening a chapter, claiming and equipping a reward, a busy raid lane and card inspection, Anu special playback, sound/reduced-motion preferences, then background/resume during a battle. Record device/browser and any failed action. These are pending hardware checks, not blockers that can be closed with desktop screenshots.

## Release execution, still held

Freeze and commit the verified batch only after push authorization; deploy with the selected dates still in the future, apply required migrations, verify the ready revision and health endpoints, enable the tester deck-code server switch, and perform live-account smoke checks. A missed launch must be rescheduled before its first deployment. Do not mutate an occurrence after accepting purchases.

Result-screen visual correction: the receipt stylesheet forces dark ink on nested record text, while the personal record still used its standalone dark background. Scoped the record background to light paper inside illustrated results; other record surfaces retain their existing styling. Before/after screenshots are retained in the launch gallery.
