# Squabble.today — friends beta

Published September 17, 2026 at https://squabble.today.

Verified deployment: [6aabdc49b1f8fb9c08bf621e](https://app.netlify.com/projects/squabblemon-triple-lane/deploys/6aabdc49b1f8fb9c08bf621e).

Latest QA release: [6aac71d8acf6353cc5d9b680](https://app.netlify.com/projects/squabblemon-triple-lane/deploys/6aac71d8acf6353cc5d9b680). See [friends-beta-qa.md](friends-beta-qa.md) for story-save corrections, expanded packs, new roster, and art updates.

## Play and install

1. Open the site and create an email account. Verify the email, then complete the starter-crew introduction.
2. Open **Fight**, pick an owned crew, and create a friend room.
3. Share the room link or code. Your friend signs into their own account, joins with their crew, and both players ready up.
4. Use **Install game** on the entry page or online lobby for home-screen instructions. iPhone: Safari → Share → Add to Home Screen. Android: Chrome → Install app. Online play requires internet.

This is an installable browser game. Friendly matches currently have no ranked rating or reward payouts.

## Hosting

- Netlify project: `squabblemon-triple-lane` (`572e48d3-6f4d-427f-9a9b-df5e195ea47c`).
- Primary domain: `squabble.today`; `www.squabble.today` redirects to it. HTTPS is enabled.
- Clerk application: Squabblemon, production environment, email/password registration with email verification. Social providers and organizations are disabled.
- Clerk frontend, account portal, email DNS records, and certificates are verified.
- Production secrets live in Netlify configuration. Never put a Clerk secret key in a `VITE_` variable or commit credentials.
- Netlify Database supplies the production connection at runtime through `@netlify/database`. Explicit `DATABASE_URL` remains available for local tools.
- The complete initial schema has been applied through Netlify's tracked migration system. All ten application tables were verified with a read-only query. Do not apply the older standalone online-room migration again.

## Release checks

- Frontend, API, and shared TypeScript checks passed; release build and entry-bundle budget passed.
- Eight focused multiplayer checks passed against an isolated database initialized with the release migration, including concurrent joins, hidden rival state, retries, full matches, reconnect, and rematch.
- The packaged API is tested before future releases: health succeeds; anonymous account and multiplayer requests are denied.
- Live HTTPS, root page, direct game route, `www` redirect, manifest, and Clerk email registration form were checked.
- Live `/api/healthz` returns 200; `/api/player/bootstrap` and `/api/multiplayer` return 401 while signed out.
- The published browser bundle contains neither the disposable test-login interface nor a live secret-key pattern.
- The install-help dialog was checked at 390×844 and 320×568. Public practice opens a battle on the published site.

## Release process

From the repository root, with an authorized Netlify CLI session:

```powershell
pnpm --package=npm --package=netlify-cli dlx netlify deploy --prod --context production --filter @workspace/squabblemon --skip-functions-cache
```

The build enforces real Clerk configuration and disables test authentication. It prebundles the API into one JavaScript module to avoid a Windows Netlify TypeScript archive-path collision and missing traced dependencies. Database migrations apply before publishing. Keep `@netlify/database` in the root manifest as well as the database library so Netlify detects and provisions it.

The current release is a manual CLI deployment from this workspace. Source-control continuous deployment has not been configured.

## First live tester check

The first real player-account save and a complete match between two real accounts on separate networks remain to be checked. Use one physical phone, refresh during a match, finish, rematch, and try surrender. Local two-session multiplayer checks have already passed; those do not replace this real-device check.

Watch function errors and database activity during the small friend beta before expanding access. Public matchmaking, ranked rewards, push notifications, and load testing remain future work.
