# Hosting-cost optimization, October 2026

This change reduces unnecessary requests without changing game rules or media
encoding. It does not establish a measured Netlify credit saving.

## Included

- Multiplayer polling pauses while its page is hidden or the browser is offline.
  Visible active rooms retain their 800 ms cadence; waiting and completed rooms
  retain their 2 s cadence for pairing and rematches. Returning players must
  reconcile a new server snapshot before commands are enabled. Writes keep their
  existing request IDs, retries, timeouts, and server-authoritative validation.
- Chapter movies render only their existing poster until the player presses
  Play. Closing a movie releases the source instead of leaving a media download
  running.
- Decorative story cinematics use the existing optional-media policy before
  requesting video, including reduced motion, Data Saver, slow connections and
  hidden tabs. Their original files and playback quality are unchanged.

## Deliberately unchanged

### Patch delivery

The minutely `patch-delivery` function is the durable continuation and retry
mechanism. Publication synchronously delivers only one 25-recipient batch.
`processOutstandingPatchBatches()` reads the database even when no work remains,
but simply slowing or disabling that scan would delay or strand delivery.

An empty in-memory flag is unsafe across function instances and cold starts.
An uncoordinated Blob flag is also unsafe: publication and queue-empty updates
can race, and a database commit can succeed while a separate enqueue fails.

Before replacing the scan, choose a durable event-driven queue or scheduling
design and test:

1. Committed publications whose enqueue fails.
2. Concurrent publication and queue draining.
3. Interrupted batches and bounded retries.
4. Idempotent inbox writes, frozen recipients and immutable campaign content.
5. Deployment rollback and already-pending recipients.

Netlify documents a minimum five-minute database inactivity period before
sleep. A query every minute can therefore keep the database awake, but the
actual cost depends on runtime configuration and traffic.

- [Database billing and sleep](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/)
- [Async Workloads](https://docs.netlify.com/build/async-workloads/overview/)
- [Background function limits](https://docs.netlify.com/build/functions/background-functions/)

### Cache policy

The existing `/assets/*` immutable HTTP policy also covers unversioned public
art. Do not lengthen it or introduce cache-first media caching as a shortcut:
returning players must receive replacement art. A separate change should emit
immutable headers only for content-addressed build files, or isolate them in a
distinct build-assets directory, while retaining revalidation for fixed names.
CDN cache hits still transfer bytes to players.

## Verification

Run from the repository root:

```sh
pnpm --filter @workspace/squabblemon test:online
pnpm --filter @workspace/squabblemon test:broadcast
pnpm --filter @workspace/squabblemon test:media-loading
pnpm --filter @workspace/squabblemon test:online-polling-browser
pnpm --filter @workspace/squabblemon test:media-loading-browser
pnpm --filter @workspace/squabblemon typecheck
pnpm --filter @workspace/api-server typecheck
```

The browser tests use local fixtures and mocked match responses, not real
accounts or database writes. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using
an existing compatible Chromium installation.

For a release, also run the repository's documented complete Netlify release
gates and exercise real two-player turn handling, background/resume, reconnection,
rematches, reward settlement, chapter Play/Close/Continue and cinematic playback
in a preview environment. Source/fixture tests do not replace these journeys.

After an approved deployment, compare like-for-like traffic windows in Netlify:
request count, video/audio bytes, function calls, database active time and billed
credits. Separate traffic changes from per-session savings. Do not claim a
percentage reduction based on source changes alone.
