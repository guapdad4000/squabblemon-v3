---
name: Friendly room series
description: Room-lifecycle rules for the per-room friendly win/loss/draw record and for reopening or closing a room.
---

A friendly room's head-to-head record is server-owned state on the room, incremented only at the
transition into a completed game. Ranked rooms never tally.

**Why:** the record must agree for both seats, survive refreshes and reconnects, and be immune to
client-reported results. Counting anywhere but that single transition double-counts timeouts, which
are recomputed on every locked read.

**How to apply:**
- Rooms stored before the record existed must read as an empty record rather than failing.
- A finished friendly room reopens into the lobby for the next game while keeping its record.
- Room intents that never touch a board (returning to the lobby, leaving) must bypass the strict
  expected-revision check, or whoever acts second gets a stale-revision error.
- Leaving on purpose is only real once the server confirms it: never navigate away on an
  unconfirmed close, or the rival waits in a room nobody is in.
- Only waiting and active rooms count toward the per-player room cap.

## Gameplay time versus inactivity expiry

Never reconstruct a past fade's time by subtracting the room lifetime from its expiry,
or treat a lobby return as new gameplay.

**Why:** reopening the lobby renews inactivity expiry without playing another fade.
Historical rooms may not have captured a gameplay timestamp at all; their known room
activity is more truthful than a guessed last-played date.

**How to apply:** keep last-played information separate from expiry and general room
activity. When historical gameplay time is unavailable, label the known timestamp
as activity rather than implying another fade happened.
