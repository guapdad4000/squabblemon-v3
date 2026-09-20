# New-account campaign verification

This procedure creates one real Clerk account, completes Rookie Road, and clears every authored campaign node through the deployed HTTP API. The default target is an isolated Netlify deploy preview or staging alias connected to its own database branch and Clerk test instance.

No reset or cleanup route is exposed by the application. Cleanup runs from the operator workstation with exact database and Clerk credentials.

## What the gates prove

- Netlify production builds accept only `pk_live_` Clerk keys. Deploy previews, branch deploys, and staging accept only `pk_test_` keys.
- `PUBLIC_ORIGIN` must be one exact HTTPS origin and must equal Netlify's current deploy origin.
- `/api/readyz` checks a database query and returns only `{"status":"ok"}` or `{"status":"unavailable"}`.
- Every request receives `x-request-id`; the run supplies `x-campaign-run-id` for log correlation.
- The database suite refuses to run without a database and fails if Node reports any skipped test.
- The remote browser spec does not install routes, replace fetch, or use development auth.

## Local database gate

Run from the repository root:

```powershell
pnpm test:campaign:db
```

The command starts an owned in-memory PGlite child on an operating-system-assigned loopback port, verifies a per-run readiness token before applying the current Drizzle schema, runs API database tests serially, rejects skipped tests, and stops the database. It never accepts a pre-existing listener as its test database.

To use an existing local PostgreSQL database, set `DATABASE_URL` first. For a remote staging database, all of these values are required:

```powershell
$env:DATABASE_URL = "<staging connection string>"
$env:APP_ENV = "staging"
$env:CAMPAIGN_DATABASE_FINGERPRINT = "<16 hex characters>"
$env:ALLOW_REMOTE_CAMPAIGN_DATABASE = "staging:<same fingerprint>"
pnpm test:campaign:db
```

Compute the fingerprint locally without printing the connection string:

```powershell
node -e "import('./scripts/database-safety.mjs').then(m => console.log(m.databaseFingerprint(process.env.DATABASE_URL)))"
```

The remote command never pushes schema. Apply tracked migrations through the normal staging migration process before running it.

## Staging setup

1. Create or select a disposable Netlify deploy preview or staging alias.
2. Attach an isolated database branch or fresh staging database. Apply the tracked migrations and take a branch snapshot.
3. Configure that deploy with a Clerk test publishable key and secret key. Use a test email address that can receive or deterministically supply Clerk's verification code.
4. Confirm the deploy's `APP_ENV=staging`, exact `PUBLIC_ORIGIN`, and database branch.
5. Choose a unique run ID of 8 to 80 safe characters. Create a local ignored manifest directory.
6. Set the environment without writing secrets to the repository:

```powershell
New-Item -ItemType Directory -Force .campaign-e2e | Out-Null
$env:CAMPAIGN_E2E_EXPECT_ENVIRONMENT = "staging"
$env:CAMPAIGN_E2E_ORIGIN = "https://<exact-deploy-host>"
$env:CAMPAIGN_E2E_DEPLOY_ID = "<netlify-deploy-id>"
$env:CAMPAIGN_E2E_DATABASE_FINGERPRINT = "<16-hex-database-fingerprint>"
$env:CAMPAIGN_E2E_CLERK_ENV = "test"
$env:CAMPAIGN_E2E_RUN_ID = "campaign-<timestamp-or-ticket>"
$env:CAMPAIGN_E2E_EMAIL = "<unique-test-email>"
$env:CAMPAIGN_E2E_PASSWORD = "<strong-temporary-password>"
$env:CAMPAIGN_E2E_VERIFICATION_CODE = "<test-inbox-code>"
$env:CAMPAIGN_E2E_MANIFEST = ".campaign-e2e\$($env:CAMPAIGN_E2E_RUN_ID).json"
```

## Preflight and run

Run preflight before creating the account:

```powershell
pnpm test:campaign:preflight
```

It verifies liveness, database readiness, anonymous authentication boundaries, the disabled development reset route, request IDs, the exact origin, database identity format, deploy ID, and Clerk environment.

Then run:

```powershell
pnpm test:campaign:remote
```

The spec signs up through the real Clerk UI and atomically writes a provisional cleanup manifest from the signed-in Clerk client before its first application API request. It enriches that manifest after profile bootstrap, completes tutorial and practice matches, claims the welcome reward, intentionally loses and retries a story battle, visits optional nodes, clears all eight chapters, and retries rewards and matches.

## Observe the run

Filter Netlify function logs by the exact `CAMPAIGN_E2E_RUN_ID`. Keep the deploy ID, run ID, Playwright trace, result JSON, request IDs around the first failure, and database fingerprint with the test record. Tokens, cookies, passwords, connection strings, and Clerk secrets are redacted or excluded.

Stop at any of these gates:

- `/api/readyz` is not 200.
- The deploy origin, deploy ID, database fingerprint, or Clerk environment differs from the approved target.
- Anonymous player endpoints do not return 401.
- The development reset endpoint does not return 404.
- A control or existing account changes.
- Cleanup identity checks fail.

## Cleanup

Cleanup requires the same manifest, origin, deploy ID, run ID, database fingerprint, database URL, and the Clerk secret. For staging:

```powershell
$env:APP_ENV = "staging"
$env:ALLOW_REMOTE_CAMPAIGN_DATABASE = "staging:$($env:CAMPAIGN_E2E_DATABASE_FINGERPRINT)"
$env:CLERK_SECRET_KEY = "<staging Clerk secret>"
$env:DATABASE_URL = "<same staging database>"
pnpm test:campaign:cleanup
```

The script validates the profile before deleting Clerk, then locks the profile again and deletes by the exact validated display name. A provisional manifest safely handles failure before bootstrap. Cleanup refuses stale or unrelated profiles and accounts involved in multiplayer rooms, verifies every player-owned row cascaded, and records Clerk deletion for retry-safe recovery. Keep the manifest until cleanup succeeds.

## Rollback

Cancel the browser run first. Do not promote the deploy. Run exact cleanup using the manifest. If the failure is limited to the campaign account, no database restore is needed because every write is scoped to that user and cleanup verifies cascades. If logs show writes outside that account, disable the affected deploy, preserve logs and traces, and restore the isolated database branch from its pre-run snapshot before investigating.

## Production gate

Use staging for routine verification. Production requires a scheduled change window, a database snapshot, a dedicated Clerk email, and these exact confirmations in addition to the normal variables:

```powershell
$env:CAMPAIGN_E2E_EXPECT_ENVIRONMENT = "production"
$env:CAMPAIGN_E2E_CLERK_ENV = "live"
$env:CAMPAIGN_E2E_VERIFICATION_CODE_FILE = ".campaign-e2e\production-otp.txt"
$env:CAMPAIGN_E2E_ALLOW_PRODUCTION = "production:<deploy-id>:<production-host>"
$env:ALLOW_REMOTE_CAMPAIGN_DATABASE = "production:<database-fingerprint>:<deploy-id>"
```

The origin, deploy ID, and database fingerprint must match the manifest during cleanup. A copied token for a different deployment or database is rejected.
