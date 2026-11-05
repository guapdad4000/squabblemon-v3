# Breakthrough on Netlify

The November 2 source deployed successfully, but public admission was closed and the Netlify API did not attach the persistent-process room service. This change adds a Netlify runtime without moving the game to another provider.

Each active room uses one signed background invocation, bounded to twelve minutes (room expiry is ten minutes). The existing fenced owner advances authoritative time, journals commands before acknowledging them, batches clock journals, and settles the existing outbox. A ten-second database dispatch reservation prevents duplicate invocation bursts. Duplicate workers lose the room lease. A once-per-minute recovery function restarts expired room owners and drains terminal receipts; normal play starts immediately through the queue.

The API uses Web Response streaming instead of its buffered Express adapter for Breakthrough. Each connection closes before forty-five seconds/token expiry and reconnects with a private baseline. Commands and per-seat deltas use PostgreSQL LISTEN/NOTIFY with bounded chunking, not repeated full-checkpoint polling or permanent per-frame snapshot writes. Notification transport is ephemeral: only the existing journal defines command acceptance. Unknown outcomes retain the browser's original command identity. Two streams per participant, per-account request budgets, bounded frames and slow-reader disconnection limit retained work.

The runtime requires session-compatible Postgres connections. `/api/breakthrough/status` tests actual cross-connection notification delivery, required schema, runtime configuration and the catalog release gate. It returns only non-secret readiness information and build identity. Do not enable player admission if the hosted notification test fails.

Configuration: functions-scope `BREAKTHROUGH_PVP_ENABLED=true` and a random secret of at least 32 characters in `BREAKTHROUGH_WORKER_SECRET`. Background dispatch signs its exact body and timestamp. Existing Clerk authentication, same-origin checks, owned-deck admission and PostgreSQL configuration remain in use. The new mirrored migration adds only a worker-dispatch timestamp.

Verification: `node scripts/test-breakthrough-database.mjs --netlify`, the packaged-function check, native migration replay and the required frozen-source build gate. These local checks do not establish hosted transport, live Clerk sessions, provider latency, billing or physical-phone behavior. Public catalog approval/evidence remains unchanged until its separate acceptance work is complete.
