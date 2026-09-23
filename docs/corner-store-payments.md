# Corner Store payments operations

## Current release preparation

The payment-only PR preserves the published story, progression, economy, and
wallet-locking implementation. Netlify native migrations are packaged at both
repository-root and monorepo package internal directories by
`scripts/stage-netlify-migrations.mjs`; Netlify applies them before publication.
Do not replace this with manual SQL or claim migration success from build
status alone: verify the exact deployment's migration metadata and branch.

Owner approvals are recorded in source. Production checkout flags remain
false and the live webhook disabled. Hosted test checkout and one authentic
500-Clout fulfillment succeeded; targeted replay evidence awaits parent
confirmation. Do not merge or activate before that confirmation. The tested
automatic-tax amount was zero; positive-tax and actual non-US network coverage
must not be claimed. The policy effective date remains null until the actual
authorized live-launch plan is executed.

The Corner Store payment path is intentionally disabled until its approvals and secrets are complete. It has no public operator route. The restricted `payment-ops` CLI is the only diagnostic, reconciliation, and test-catalog seeding entry point. Do not run it against Stripe or a database as part of setup or deployment.

## Setup order

1. Apply the additive payment-orders/events/fulfillments database migration before deploying payment code. Do not combine this with destructive schema work.
2. In Netlify environment settings, configure mode-specific `STRIPE_TEST_SECRET_KEY` / `STRIPE_LIVE_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET` / `STRIPE_LIVE_WEBHOOK_SECRET`. The owner approved standard environment scopes, including build access. Never expose provider secrets in client-prefixed variables, bundles, or logs.
3. The owner approved configuring one-time USD prices of $2.99 for 500 Clout, $7.99 for 1,500, and $19.99 for 4,000, with exclusive tax. This configuration approval is not live activation approval. Mode-specific prices use `STRIPE_TEST_PRICE_*` and `STRIPE_LIVE_PRICE_*`.
4. Set `PAYMENTS_PUBLIC_ORIGIN` to the exact, verified HTTPS deployment origin (no path or trailing credentials). Configure support and refund-policy URLs before approval.
5. Keep `PAYMENTS_ENABLED=false` through setup. Switching it to false later immediately stops only new checkout creation; the signed `/api/payments/webhook` endpoint must remain available so existing payments can settle.

For Replit test development only, `PAYMENTS_REPLIT_TEST_PROXY=true` may use the connected Stripe integration. That connection is test-only and available to the running Replit environment; no Stripe secret is exported from it into Netlify. Netlify still needs its own test secret when test mode is used there.

### Remote configuration evidence (configuration only)

Stripe validated the owner-selected `txcd_10000000` as “General - Electronically Supplied Services” in both accounts. Exactly three live Clout products were created; the three existing sandbox Clout products were reused and updated to this classification. Catalog metadata is `corner-clout-v2-tax`, with stable offer IDs. Other products and live global tax settings were not changed.

| Offer | Live exclusive USD price | Sandbox exclusive USD price |
| --- | --- | --- |
| Pocket, 500 Clout / 299 cents | `price_1UIwt4Dx32cFaDaJRLu7Trje` | `price_1UIwt6PS2xQPaVHP5bnLeQ9e` |
| Stack, 1,500 Clout / 799 cents | `price_1UIwt5Dx32cFaDaJFXAcnXLp` | `price_1UIwt6PS2xQPaVHPI9lAttI4` |
| Bag, 4,000 Clout / 1,999 cents | `price_1UIwt5Dx32cFaDaJBFfHFk30` | `price_1UIwt6PS2xQPaVHPhZm9Rgic` |

Sandbox Tax became active after securely copying the live head-office address and creating the sandbox California registration. No address is recorded here. Netlify production is configured for live mode and deploy-preview for test mode, with both payment enable flags false in both contexts. Standard scopes were used for new settings. Existing Clerk settings were changed only in the deploy-preview context; its secret remains API-redacted and requires hosted verification. Production payment origin, support URL, and refund-policy URL use `https://squabble.today`, `/support`, and `/refund-policy`.

Preview origin, preview policy URLs, webhook endpoints/secrets, hosted testing, native deployment migrations, and publication remain release-worker steps. This evidence does not claim a deployment, tax-inclusive checkout test, or live activation.

Authentic signed webhook handling was verified in development with a real Stripe test Checkout, successful signed delivery, and a Stripe-originated redelivery of the same event. The retry returned HTTP 200 without changing the wallet or adding another fulfillment. Automated/mock tests remain separate evidence and must not be represented as provider delivery verification.

## Live launch gate

See [the launch approval record](corner-store-launch-approvals.md) for owner decisions: the three USD base prices, United States-only 18+ purchases, a California business location, reported Stripe eligibility confirmation, public seller and support destination, and the existing 14-day unused-Clout policy approved for publication at launch. The owner confirms support delivery tested and mailbox monitored and reports both Stripe Tax registrations/automatic calculation and business verification completed. These are owner attestations, not independent live-account validation. Checkout must disclose the base price and let Stripe show the tax-inclusive final total before payment. Hosted Netlify configuration/testing remains a blocker; do not deploy or enable live payments yet.

`LIVE_APPROVAL.approved` is deliberately `false`; environment variables cannot activate live checkout by themselves. A reviewed source change is required, and there is no automatic activation or deployment step in this procedure.

Written merchant approval must cover whether selling virtual currency that can be spent on randomized and earned game content is eligible, required player age controls, permitted regions, tax treatment, final currency and base prices, refund policy, and a staffed support process. The owner reports automatic Stripe Tax setup completed, but the intended live-account settings and hosted tax-inclusive checkout still require verification. All live gates and the exact production origin must be verified before `PAYMENTS_LIVE_ENABLED=true` is considered.

Onboarding currently attests to 13+, not 18+. New checkout separately requires explicit adult and US-location declarations, checked by the server before reserving a new order. Existing-order retries retain the original immutable parameters and do not require new declarations; settlement is unchanged. Declarations are not verified age/location or a claim of legal sufficiency.

On Netlify, new reservations also require US IP-derived geography from `context.geo.country.code`. The v2 adapter binds this trusted value with request-scoped AsyncLocalStorage and the route passes it to checkout; no incoming country headers are consumed. Missing context/country or non-US geography fails closed, including production without Netlify context and hosted previews. Local test mode without hosting context remains available. Existing-order retries and signed settlement bypass this new-admission check, avoiding taking payment and subsequently withholding purchased Clout. IP-derived geography can differ from physical presence; this is not verified residency/location. Validate actual deployed invocation behavior before launch.

The catalog and order `amountMinor` remain the approved bundle **base price**. For automatic-tax orders, `taxAmountMinor` and `totalAmountMinor` stay null until the provider-confirmed payment supplies the durable tax and final total. The client must not present a pending base price as the amount paid. Historical `taxMode=none` orders remain readable under their original quote, while automatic-tax fulfillment and refund reporting use the server-recorded tax-inclusive total and refund amount.

Repository readiness inspection only: `netlify.toml` builds with `scripts/build-netlify.mjs`, publishes `artifacts/squabblemon/dist/public`, and serves functions from `artifacts/api-server/dist/netlify-functions`. The approved release route uses Replit's connected GitHub API to update `main`, which auto-deploys to Netlify; CLI login is not the prerequisite. Direct Netlify environment access remains separate. No push, deployment, secret inspection, migration, or hosted test was performed in this preparation step.

## Stripe webhook events

The service consumes only:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`
- `charge.dispute.updated`

Other merchant-account events are ignored. Signatures and test/live mode are checked before processing. Retain the payment order, event IDs, fulfillment record, and dispute/refund state for audit and reconciliation; do not store card data, customer payment details, or unrelated PII.

## Restricted CLI

Run only from an access-controlled operator environment using the API package command supplied by the repository. It never prints provider keys, checkout URLs, usernames, card data, or raw Stripe error payloads.

Invoke the commands below with `pnpm --filter @workspace/api-server payments:ops` in place of `payment-ops`.

Every database command requires `DATABASE_URL` and an explicit target confirmation:

- Local: `--confirm local:<fingerprint>`
- Remote staging/production: set `PAYMENT_OPS_DATABASE_FINGERPRINT` to the displayed/independently calculated database fingerprint and confirm `staging:<fingerprint>` or `production:<fingerprint>`.
- Production additionally requires `DEPLOY_ID`, the exact `PAYMENTS_PUBLIC_ORIGIN`, and `PAYMENT_OPS_PRODUCTION_CONFIRM=production:<fingerprint>:<deploy-id>:<origin-host>`.

The tool refuses unknown remote environments. First use the read-only aggregate diagnostic; an exact `--order` diagnostic returns only that order's minimal operational status, never a username:

```text
payment-ops diagnostic --confirm <environment:fingerprint>
payment-ops diagnostic --order <order-id> --confirm <environment:fingerprint>
```

Reconciliation reads Stripe and may settle database state, so it requires an exact order plus both explicit controls:

```text
payment-ops reconcile --order <order-id> --apply --confirm <environment:fingerprint>
```

The test-only catalog command refuses live mode, uses stable catalog/offer metadata and idempotency keys, and emits only the three `STRIPE_TEST_PRICE_*` mappings:

```text
PAYMENTS_MODE=test payment-ops seed-test-catalog --apply --confirm test:corner-clout-v1
```

Before applying, capture the order ID, reason, target fingerprint, expected provider state, and approver. Afterward, record the minimal result and reconcile it with the Stripe Dashboard and retained event IDs. Never paste CLI output containing operational identifiers into public support channels.

## Refunds, disputes, and support

Issue refunds manually in the Stripe Dashboard under the written refund policy, then allow signed refund events to reconcile the order. Partial refunds are recorded truthfully by amount, but there is no automatic partial Clout regrant or deduction. A refund or dispute also does not automatically remove previously granted Clout.

If purchased Clout has already been spent, any wallet correction is a separate, explicitly approved support action performed under the player's profile lock. It must be documented against the order and must never silently erase earned rewards. Do not improvise negative balances. Preserve disputed-order and resolution records, Stripe evidence, event IDs, operator approvals, and reconciliation notes even after a dispute closes.

Support should authenticate the account, collect only the order ID and issue description, avoid card/PII collection, link the case to retained operational evidence, and follow the approved retention/deletion schedule. Escalate ambiguous sessions, duplicate metadata matches, unmatched amounts, partial refunds, spent balances, and disputes rather than retrying checkout or editing records directly.

## Reproducible automated checks

- `env -u DATABASE_URL pnpm --filter @workspace/api-server test:payments` starts a temporary, loopback-only native PostgreSQL cluster, tests independent-connection locking and late-write rollback, and removes its own cluster afterward. PostgreSQL tools are required. This is deliberately separate from the single-connection PGlite suite.
- `pnpm --filter @workspace/api-server exec tsx --test src/lib/webRequestAdapter.test.ts` tests byte preservation with locally generated signatures, not Stripe-delivered webhooks.
- `node scripts/build-netlify-function.mjs && node scripts/check-netlify-function.mjs` exercises the shipped Netlify function bundle, including the narrowly exempted webhook when Clerk configuration is absent.
- `pnpm --filter @workspace/squabblemon test:payment-store-browser` mounts the actual store and header with explicitly mocked HTTP responses. It must not be cited as provider payment evidence.

Development verification includes a real test-mode Checkout completion, authentic signed delivery and redelivery, one durable fulfillment, and a matching account balance. Netlify hosting validation remains a separate check after deployment is authorized. Never substitute an altered return URL or a locally generated signature for authentic provider evidence.

See [the verification record](corner-store-payments-verification.md) for completed evidence and the remaining activation blockers.