# Corner Store live-launch approvals

Status: owner requested the remaining launch steps. Live activation remains disabled until the intended live Stripe account, checkout tax treatment, Netlify payment configuration, and hosted test flow are verified.

## Owner decisions received

| Item | Decision | Evidence |
| --- | --- | --- |
| Prices and currency | 500 Clout: USD $2.99; 1,500: USD $7.99; 4,000: USD $19.99 | Explicit owner approval |
| Business location | California, United States | Owner statement |
| Purchase age | 18+ | Owner requirement; enforcement must be checked before launch |
| Stripe eligibility | Owner reports Stripe has confirmed this business model is eligible | Owner attestation, not independent provider-document verification |
| Refund policy | Existing 14-day unused-Clout terms approved for publication at launch; not yet effective | Explicit owner approval; no independent legal review claimed |
| Customer countries | United States only | Explicit owner decision |
| Seller | It’s a check inc | Owner-provided public name |
| Support destination | Guapshipping@gmail.com | Owner confirms delivery tested and mailbox monitored; not independently verified |
| Tax treatment | Owner reports both Stripe Tax registrations/automatic calculation and business verification completed | Owner attestation; intended live-account settings and automatic-tax checkout still require hosted validation |

## Unresolved launch requirements

- Public `/support` and `/refund-policy` pages show owner-approved launch terms, not yet effective. Mailto links open the visitor's email app and do not submit messages themselves. Record an effective date only when live purchases launch.
- Verify the automatic-tax checkout against the intended live account. Base price remains the approved bundle price; Stripe must calculate applicable tax and show the final total before payment.
- Verify hosted purchase admission before launch.
- Existing onboarding confirms **13+**, not 18+ (`src/pages/game/Onboarding.tsx`). New checkout separately requires explicit 18+ and US-location declarations in the UI and server. These are self-attestations, not verified age/location, and no claim of legal sufficiency is made.
- Hosted new checkout now requires US IP geolocation from trusted Netlify invocation `context.geo.country.code`, bound per request with AsyncLocalStorage. Missing/non-US geography fails closed before reservation/provider checkout. Browser headers are ignored. This is an IP-derived restriction, not proof of physical presence; hosted testing remains outstanding. Existing checkout retries and paid settlement remain unchanged.
- Read-only queries of the connected Stripe API report test mode, charges disabled, tax settings pending with `head_office` missing, and no active tax registrations. This is evidence about the connected test account only, not a finding about the owner's separate live account. The owner reauthorized the separate Stripe MCP connection and its authorization now reports healthy, but no callable Stripe tools were exposed in this session; do not request another reconnect for a healthy authorization.
- Verify the production Netlify origin and account-specific live Stripe configuration, using secure configuration rather than chat for credentials.
- Netlify REST API access verified the expected site and published GitHub release. Attempts to create function-scoped settings returned HTTP 403, “Upgrade your Netlify account to set specific scopes.” No secret settings were created. The non-secret `PAYMENTS_ENABLED=false` control was subsequently configured successfully for production and deploy previews using default scopes. Do not silently widen secret scope to build access.
- The replacement live credential now verifies against a separate live account with charges and payouts enabled, business details submitted, no currently due requirements, Stripe Tax active, and an active California registration. The test credential remains a restricted test key. No credential values are retained here.
- The live account's default product tax classification is `txcd_10401100` (downloaded digital audio), not an approved classification for Clout. No Clout products or prices have been created in live mode; obtain a suitable confirmed classification rather than inheriting the unrelated default.
- Use the approved Replit-connected GitHub API release route, not CLI login. GitHub release access and Netlify REST access are verified; function-only environment scoping is currently blocked by the Netlify plan.
- The automatic-tax migration has been applied transactionally to development only. Netlify's migration API reports only the initial migration applied in production. Netlify natively applies the repository's migration directories before publishing production and deploy previews, with failures blocking publication; no manual CLI or SQL step is required. Use an isolated PR preview for hosted payment tests before production release.
- After configuration and classification are resolved, test authentic checkout and webhook delivery/redelivery through the hosted Netlify test-mode endpoint. The owner's request to do the remaining launch steps does not waive readiness checks.

All source live-approval flags remain false while the combined launch approval is incomplete. No environment setting, price approval, or draft document alone authorizes live checkout.