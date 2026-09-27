# Verification record

Audit scope is offline source/rule analysis. No runtime files, historical audit
fixtures, game prices, rewards, odds, payment gates, provider configuration,
accounts, migrations or deployed data were changed.

## Checks

The three focused diagnostic suites cover:

- Production pack resolver with seeded integer RNG, rarity statistical bounds,
  separate matching/universal receipts, forced Rare+ replacement, eligible style
  pity, exhausted styles, tier-local protection, reproducibility, participation
  and online-zero-reward modeling.
- Current source/catalog hash parity, full story reward inventory, login UTC
  resets/cycle and missed days, new-player window, level reward batches and
  receipt suppression, Growth watering evidence/gaps, Stockz EV/distribution
  source guards, prorated training and matching-first shard payment.
- Account versus card XP, caps and milestone thresholds, legacy/current
  snapshots, normalized online combat, pure surrender/timeout/rematch fixtures,
  repeat bot rank accumulation, and a labeled source-only online profile-write
  assertion.

Tests use pure rules and isolated in-memory fixtures. The mode write assertion
is source inspection, **not a database settlement/concurrency integration test**.
Historical provider-delivery and native PostgreSQL evidence were not rerun and
must not be conflated with these results. No live loop, charge, promo redemption
or account mutation was attempted.

## Commands and results

Final executed checks on 2026-09-27:

| Command/check | Result |
| --- | --- |
| `node --import tsx scripts/src/economy-current-ledger.ts --check` | Passed; exported story and source-hash manifest match |
| `node --import tsx --test scripts/src/economy-current.test.ts scripts/src/economy-current-ledger.test.ts scripts/src/economy-current-modes.test.ts` | 23 passed, zero failed/skipped |
| `pnpm --filter @workspace/scripts typecheck` | Passed |
| `node scripts/render-economy-audit.mjs` | Generated readable tables and self-contained downloadable HTML with embedded JSON evidence |
| Existing web preview at 1280×800 | Landing page rendered; no browser error, expected Clerk development-key warning |
| Source scope check against inspected HEAD | Runtime and historical audit files unchanged; audit-only additions |

No workflow restart was needed: application code, dependencies and run commands
were not changed. The preview check did not authenticate or make purchases.

The checked-in simulation uses seed 408686590, 10,000 independent pack trials
per cohort/opening, 100 per journey, 500 per finish target and the documented
renewal sample for style lifetime.

## Limits

- No new production or database evidence; current checkout flags, live balances,
  actual players' behavior and positive-tax delivery are unknown.
- No cross-connection transaction tests in this audit. Source locks and unique
  receipts are evidence of implementation intent, not proof of deployed schema.
- No screenshot can prove a paid boundary. A running-app preview check is only
  a coarse check that the untouched application is not visibly broken.
- No source simulation is retention, fairness, willingness-to-pay or profitability
  evidence. Session minutes and collection cohorts are explicit assumptions.
- The older simulator and report remain untouched historical artifacts; their
  flat-shard runtime-parity check is superseded for current-rule analysis.