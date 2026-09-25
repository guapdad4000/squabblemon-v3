# Safehouse mail

The wooden door in the safehouse shows unread deliveries and knocks until they have been read. Clicking it opens the door, moves the camera, and opens the Mailman's delivery screen. Reduced-motion settings suppress the knocking. Reading and claiming are separate: a read letter can still have an unclaimed gift. The client refreshes every 30 seconds while active, on window focus, and when opening the inbox.

Mail is saved in `player_profiles.inbox`. Authenticated players can only list, read, or claim their own mail. Gifts currently support Clout (`softCurrency`), Pack Tickets (`packTickets`), and Style Shards (`styleShards`). Claims lock the profile row and update the gift and wallet in one transaction. Repeat claims never credit twice. No schema migration is needed.

## Developer delivery

Use the server-side operator command with the intended server database environment. No delivery endpoint is exposed to players. The operator needs database access; do not place database credentials in the client.

Create a JSON file, for example:

```json
{
  "id": "anniversary-2026",
  "title": "One year on the block.",
  "sender": "The Squabblemon Team",
  "body": "Thank you for being part of the city. Here is a gift from all of us.",
  "gift": { "softCurrency": 500, "packTickets": 2, "styleShards": 50 }
}
```

From the workspace root, preview and then send:

```sh
pnpm --filter @workspace/api-server exec tsx src/tools/mail-ops.ts /absolute/path/message.json all
pnpm --filter @workspace/api-server exec tsx src/tools/mail-ops.ts /absolute/path/message.json all --apply
```

Replace `all` with one Clerk user ID or comma-separated IDs for targeted packages. `all` targets profiles that exist when the command starts, not future signups. Omit `gift` for an announcement. A dry run validates recipients and conflicting campaign content without changing accounts. Currency amounts must be nonnegative integers up to 1,000,000 per gift field.

Use a unique, stable ID per campaign. Re-running the same ID and content resumes an interrupted delivery without duplicate gifts. Reusing it with different content is rejected. Sends are atomic per recipient, not across the entire audience. If interrupted, rerun the same command; existing deliveries and claim state are preserved. Re-running `all` later also includes any accounts created since the first run. This version has no scheduled sends, attachments, expiry, or developer web dashboard.

## Verification

`env -u DATABASE_URL node scripts/test-payments-database.mjs --mail` provisions and cleans up an isolated native PostgreSQL cluster, tests concurrent claims/delivery, rollback, authentication, recipient isolation, and broadcast. The general API database suite also discovers the non-broadcast tests. No real-player gifts are sent during testing.

From `artifacts/squabblemon`, run `pnpm exec playwright test --config e2e/playwright.mail.config.ts` for desktop/phone read, claim, retry, reload, empty/error, and reduced-motion checks. This starts an isolated dev preview on port 4199 if needed and mocks delivery data. Screenshots go to `/tmp/squabble-safehouse-mail-*.png` to avoid dev-server reloads during capture. The example anniversary letter in screenshots is test data.
