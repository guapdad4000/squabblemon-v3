---
name: City Never Sleeps rules
description: Durable gameplay and release decisions for the ten-card City Never Sleeps expansion.
---

Discounts and Landlord tax must be explicit match state shared by affordability, CPU choice, replay snapshots, and server verification. Apply at most one oldest eligible discount before a non-stacking first-play district tax.

**Why:** Hidden or client-only cost modifiers would let the displayed Motion cost disagree with authoritative replay.

**How to apply:** Any future cost modifier must join the same effective-cost breakdown rather than changing only a button label or only `playCard`.

Car Meet Kid and Delivery Demon currently move deterministically. Player-selected movement requires a typed move transcript before it may replace that behavior.

**Why:** The existing authoritative transcript records card plays and must reproduce the exact board on the server; unrecorded client choices would invalidate rewards and replay.

**How to apply:** Preserve deterministic target and destination tie-breaks until source, destination, and optional buff target are validated and replayed as authoritative move data.

City Never Sleeps is an additive, idempotent release grant to every normalized profile.

**Why:** The user chose to import all ten as playable immediately, rather than releasing them as locked catalog art.

**How to apply:** Keep the grant non-destructive: retain existing ownership, decks, cosmetics, and progression while ensuring all ten expansion catalog IDs remain owned and discovered.