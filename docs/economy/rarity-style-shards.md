# Rarity Style Shards

New Street Pack extra copies award matching rarity currency. Card drop rates,
pack prices, protections, pity and cosmetic prices are unchanged. These currencies
only buy cosmetics; character strength still uses XP and Clout.

| Source card rarity | Wallet tier | Shards per duplicate | Tagged / Chrome cost |
| --- | --- | ---: | ---: |
| Super Common or Common | Common | 5 | 80 / 140 |
| Uncommon | Uncommon | 8 | 80 / 140 |
| Rare | Rare | 12 | 80 / 140 |
| Super Rare (internal Epic) | Epic | 20 | 80 / 140 |
| Legendary | Legendary | 40 | 80 / 140 |
| Mythical | Mythical | 80 | 80 / 140 |

Rarity controls availability; the larger payouts make a rare duplicate valuable.
A Mythical duplicate covers one Tagged finish. Other existing variant prices and
signature collection prices (60 / 100 / 120) remain exactly as authored.

## Spending and existing accounts

- `styleShards` stays universal, with the exact same amount and purchasing power.
- `styleShardBalances` is additive. Existing accounts start with zero tier shards.
- Spend matching currency first, then universal currency for the shortfall. The UI
  shows both amounts before purchase. Other tiers cannot substitute or convert.
- Shop and direct crafting use the same engine quote/debit rules under the existing
  profile row lock. Retried unlocks do not debit again. Shop receipts retain the split.
- Never reconstruct balances by replaying old pack history. Only a new persisted
  reward with explicit `shardRarity` credits that tier. Missing/null means universal,
  even if the historical receipt has a source card and card rarity.
- Pack bonus shards remain universal (nominal 30% for 5, 10 or 15). Existing daily,
  promo, mail and finite progression rewards retain their universal grants.
- Story duplicate compensation stays 25 universal; the one-time welcome pull and
  Collection Road retain their existing 5-universal duplicate promise.
- Pack receipt versions become `street-pack-v7` and `street-pack-ten-v3`.
  Odds themselves did not change. The ten-pull guarantee recomputes currency totals
  after replacing its final gameplay reward, so the displaced reward is not credited.

## Balance expectations

For a player owning the entire roster, the five ordinary gameplay slots produce
an expected 36.6 matching shards per single pack: 15 Common, 10 Uncommon, 7.2 Rare,
2 Super Rare, 1.6 Legendary and 0.8 Mythical. These are separate currencies, not a
36.6-shard universal payout. This excludes the bonus slot and ten-pull guarantee.
Players still collecting new characters receive fewer shards because new cards
are retained. This is a first balance pass, not a claim of measured retention or
fairness; tune from issued-currency and redemption data before changing prices.

## Deployment

Netlify deploys `netlify/database/migrations/202610010004_style-shards/migration.sql`
before publishing the new API. The matching standalone SQL is
`lib/db/migrations/20260926_style_shard_balances.sql`. Migration coverage is checked
during the release build, but the build does not query the runtime database:
that branch may not have been migrated yet. After Netlify applies native
migrations, its `deploy-succeeded` function checks all `player_profiles`
columns against the deployed API's own pool and search path on every production
and preview branch. This reads PostgreSQL metadata only; it never runs DDL,
reads player rows, or logs a connection string. Missing columns or a connection
failure fail the event invocation and notify `STORE_CHECK_ALERT_WEBHOOK` when
configured. Check Netlify function logs and any release alert before treating
a successful deployment as schema-ready; the event cannot retroactively change
the deploy's `ready` status. Both migrations add one non-null JSONB column
defaulting to `{}` and leave existing balances and receipts untouched.
Reapplying preserves new balances too. Do not backfill from historical receipts.
The old frontend can read the additive response but cannot display all currencies;
deploy the updated frontend with the updated server. Production migration execution
is handled by Netlify, not by local development commands.

## Runtime profile schema preflight

The public page and `/api/healthz` can load while signed-in bootstrap fails
because the API selects every `player_profiles` column and also needs the
`player_missions`, `player_pack_openings`, `player_collection_claims`, and
`player_matches` relations. Before starting the local API,
`pnpm --filter @workspace/api-server run dev` runs a read-only table and
column check. Run it separately with
`pnpm --filter @workspace/api-server run db:preflight` when diagnosing a target.
It checks the exact database resolved by the API process (`DATABASE_URL` when
set, otherwise the Netlify database connection) and the active search path.
The check reads PostgreSQL metadata only: it does not create a profile, apply
migrations, or print the connection string. Missing tables and missing columns
are reported separately. Connection failures are reported without raw driver
details.

If it fails, verify which database branch the **API runtime** selects and
review the missing columns against the migrations for that branch. Back up and
apply the reviewed migrations using the database's normal migration process,
then rerun the preflight before retrying sign-in. For `style_shard_balances`,
the standalone migration is
`lib/db/migrations/20260926_style_shard_balances.sql`; Netlify has the matching
`netlify/database/migrations/202610010004_style-shards/migration.sql`. Other
missing columns may require other migrations; do not blindly run a force push
or change a different database just to make the check pass. Netlify applies
its migrations during deploy, so this local runtime check is not a Netlify
build-time gate against a pre-migration database.

Validation: shared-engine payment tests; isolated PGlite pack/craft/shop retry,
legacy bootstrap, wallet and existing reward regressions; UI typecheck and build;
responsive preview and actual style, collection, inventory, market and inspector
surfaces. The PGlite harness serializes DB connections; a native PostgreSQL deployment
should retain the existing row locks and transactions for concurrent production use.
