# Corner Store payment verification

## Current isolated hosted preview evidence

On ready deploy `6ab4426b8743f80008889427`, the hosted-test worker reported an
authentic Clerk test-account flow on the isolated preview database, a real
Stripe-hosted Pocket payment (base 299 cents, automatic tax complete, tax 0,
total 299), authentic signed completion, and exactly one durable 500-Clout
credit reflected in the wallet/header. Cancellation, re-authentication,
refresh, adult-declaration denial, and forged-country-header tests passed.

The Stripe-origin replay requested at **2026-09-23 21:40:16.761 UTC** is
correlated with the exact preview deployment's Netlify function record at
**21:40:17.280 UTC**: `POST /api/payments/webhook`, `res.statusCode=200`.
This destination record is separate from Stripe's retry-API HTTP-200
acknowledgement. The Netlify adapter's request logger labels the record
`request aborted`; the reported status evidence is its explicit response
status field, not an interpretation of that label. The wallet remained 500,
with one completion event and one fulfillment totaling 500 Clout.

An additional Stripe-origin replay was acknowledged at 21:44:09.994 UTC;
its immediate bounded log query did not contain a new delivery record, so it
is not counted as additional destination-response evidence. The ledger
remained unchanged. No locally constructed signature, reconstructed payload,
or direct fulfillment/reconciliation call was used.

Function records were read through Netlify's authenticated historical-log
REST API, filtered by exact branch, deployment ID, and UTC interval, using
the protocol documented in the
[Netlify CLI's log API implementation](https://github.com/netlify/cli/blob/main/src/commands/logs/log-api.ts).
No CLI login or credential export was used.

A second disposable development Clerk account authenticated normally and
received **404** when requesting the first account's paid order; its own
order-history endpoint returned **200** with no orders. That second account
was then deleted without creating a payment or eligibility fixture. The
paid account and its payment/event/fulfillment audit remain intact.

This is real hosted test-mode evidence, separate from the mocked browser
suite and locally signed adapter tests below. No positive tax amount or
actual non-US network was exercised; do not describe those as hosted
coverage. No live charge was made.

Both native payment migrations are applied on exact database branch ID
`preview/corner-store-payments-141`; production still has only the initial
migration. The payment-only candidate leaves published story/progression/
economy and existing profile locks unchanged. Source owner approvals are now
recorded, but both production checkout flags remain false and the live
webhook remains disabled during production release checks. The parent confirmed
the replay evidence and authorized staged activation. Public policy effective
date is `2026-09-23`, the current UTC launch date. Final production deployment,
migration, webhook, and enablement evidence must be recorded after verification.

## Historical development evidence

## Result

The implementation and a real Stripe test purchase are verified. Development checkout is enabled only in Stripe test mode; the source-controlled live approval flags remain false. No live charge or production deployment was made.

The Stripe test webhook signing secret is securely configured and was never displayed in chat. A real Stripe-hosted test Checkout for the 1,500 Clout bundle completed through the development API path. Stripe recorded the paid `checkout.session.completed` event, the signed webhook was accepted, and the database recorded one event, one fulfillment, and one 1,500-Clout credit on the account wallet. Stripe subsequently redelivered that same authentic event; the endpoint returned HTTP 200 and the wallet and fulfillment ledger remained unchanged. Mocked and locally signed tests are documented separately below.

## Evidence completed

| Check | Result | What it establishes |
| --- | --- | --- |
| Payment tests on isolated native PostgreSQL | 16 passed, no skips | Request retries, authorization, ownership, validation, event ordering, transaction rollback, and competing wallet operations using independent database connections |
| Corner Store helper tests | 7 passed | Fail-closed request journaling, order IDs, safe links, terminal states, and truthful refund/dispute copy |
| Hosting adapter tests | 3 passed | Untouched UTF-8 payload bytes and locally generated Stripe signature verification, alongside existing adapter behavior |
| Mounted browser tests | 14 cases passed across the full-suite and final targeted landscape runs | Actual Shop/header/fixed-height route hierarchy, checkout requests, delayed confirmation, recovery, history, preview-only shelves, and native wheel/keyboard navigation at 320×568, 390×844, 768×1024, 1440×900, and 844×390; all payment HTTP responses mocked |
| Netlify function bundle checks | Passed | Built function health/auth behavior and the exact webhook's independence from missing Clerk configuration |
| TypeScript checks | Passed after integration and merge fixes | Full workspace typecheck includes shared libraries, API, game, sandbox, and scripts |
| Running development preview | Loads | Managed API and web workflows restarted, logs inspected, unsigned webhook rejected with HTTP 400 |
| Connected Stripe Checkout and webhook | Passed in test mode | A real 1,500-Clout test Checkout became paid and fulfilled; Stripe and the database agree on one signed completion event, one fulfillment, and one wallet credit |
| Authentic Stripe redelivery | Passed in test mode | Stripe retried the original completion event to the configured development endpoint; HTTP 200, still one event and one fulfillment totaling 1,500 Clout, with the before/after wallet balance identical |

Full-route browser screenshots are retained in `artifacts/squabblemon/e2e/screenshots/payment-store-route-{320,390,768,1440,844}.png` and the corresponding `payment-order-route-*.png` files. The last bundle, expanded order history, pending checkout address, dialog dismissal, Shop tabs, and all Fade Market shelves are exercised with real pointer hit checks. The rotated paper tabs allow only a two-pixel decorative border tolerance; actionable centers must receive clicks.

These are mounted-component fixture screenshots with mocked payment responses, not the approved catalog or proof of payment. Their deliberately different quotes prove server-catalog authority. The separate running-preview snapshot correctly showed sign-in because the screenshot browser has no player session.

Commands and operator safeguards are documented in [Corner Store payments operations](corner-store-payments.md).

## Authentic provider evidence — 2026-09-23 (UTC)

- Completed test bundle: 1,500 Clout at USD $7.99; the provider reported `livemode=false` and `payment_status=paid`.
- Initial signed webhook: `POST /api/payments/webhook`, HTTP 200 at 13:24:01 UTC.
- Redelivery: requested at 13:50:56 UTC through the connected test account using Stripe's own CLI operation, `POST /v1/events/{event}/retry` with the exact `webhook_endpoint`. The event's paid status, test mode, order reference, and endpoint's test mode and development URL were checked before requesting it.
- Resent signed webhook: HTTP 200 at 13:50:56 UTC. No locally generated signature, reconstructed payload, or direct fulfillment call was used.
- Before and after redelivery: one stored event, one fulfillment, 1,500 total fulfilled Clout, and no account balance change. Customer identifiers and checkout links are deliberately omitted.

The resend operation is defined in [Stripe's CLI source](https://github.com/stripe/stripe-cli/blob/master/pkg/cmd/resource/events_resend.go). No CLI installation or credential export was needed. These are development Express endpoint results. Netlify adapter byte preservation is covered separately by the adapter and built-function checks; no deployed Netlify webhook test is claimed.

## Required before live activation

US admission implementation checks: native PostgreSQL suite 17 passed; API typecheck passed; adapter tests 3 passed; Netlify bundle build and built-function checks passed. Tests cover missing/non-US/US trusted country, unknown context, preview context, context absence in production, forged incoming country headers, concurrent request context isolation, and historical retries/settlement without geography. These are automated tests, not hosted Netlify geolocation evidence. No live activation or deployment occurred.

Latest preparation checks: mobile running-preview `/refund-policy` renders the owner-approved/not-yet-effective wording correctly. OpenAPI codegen and its library build passed, resolving stale economy type outputs; fresh game typecheck passed afterward. Native PostgreSQL payment suite: 16 passed, including new-declaration rejection and existing-order retry compatibility. Targeted mocked checkout browser tests: 2 passed (adult/US checkboxes, retry payload stability, local policy links). Public policy desktop/mobile tests: 2 passed. New checkout declarations are server-required self-attestations, not independently verified age/location; historical settlement is unchanged. No managed workflow restart, deployment, or hosted-payment test was performed in this preparation step.

Automatic-tax frontend checks: all 17 mounted payment-store browser cases passed, including an automatic-tax quote, a provider-confirmed taxed total, a confirmed zero-tax total, a pending order whose final total is not yet confirmed, a historical no-tax order, tax-inclusive refund disclosure, and an older catalog response with unknown tax mode. Public policy desktop/mobile checks passed 2/2 and the game typecheck passed. Retained screenshots show the mounted checkout disclosure and server-backed order totals. HTTP responses in these checks are mocked; this is not hosted Stripe Tax evidence.

1. Complete the remaining verification in [the launch approval record](corner-store-launch-approvals.md). The owner approved the USD $2.99/$7.99/$19.99 base prices, United States-only 18+ purchases, seller/support details, and existing refund terms, and reports both Stripe Tax registrations/automatic calculation and business verification completed. Those reports are not independent live-account validation. Hosted checkout must prove applicable tax is calculated, the final total is disclosed before payment, and the same tax-inclusive total is verified for fulfillment and refunds. Existing onboarding is 13+ and does not itself enforce the purchase age. Hosted Netlify configuration/test evidence remains outstanding. No production deployment or live activation was performed.
2. Configure Netlify Functions' own mode-specific provider secrets and Price mappings, apply the additive production migration through the existing Netlify procedure, and obtain explicit authorization before any deployment or live activation.
3. Once deployment is authorized, validate the hosted Netlify test-mode endpoint before enabling live charges. This development verification does not authorize production changes.