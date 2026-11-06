# OG Blue lane-combat correction

OG Blue (`blue-side-1`) and Blue Triple OG (`triple-og-blue`) inherited printed Hands-loss resistance as immunity to every collision in Breakthrough. Even a stronger opposing fighter could not defeat them. An older integration test incorrectly required that behavior.

In Breakthrough, `cannotLoseHands` now protects against ability and status Hands loss. Physical lane collisions deal damage normally, including lethal damage and the existing frozen-fighter rule. Full damage immunity, ability-only immunity, shields, and other damage prevention still use their existing rules. The main turn-based PvP implementation is unchanged.

The combat regression covers both Blue identities on both seats, sequential nonlethal and lethal collisions, damage attribution, seeded Silence, ability damage resistance, Freeze, and retained full damage immunity. The previous collision expectation is replaced. Kumite descriptions for Crossfire, Homage, and Blue Nose Backup explain the distinction. No polling, stream cadence, database schema, or network payload fields change.

Acceptance must be regenerated with `scripts/verify-breakthrough-catalog.ts` and the rendered catalog verifier before sealing `kumite-catalog-evidence.json`. The source fingerprint gate remains enforced. The required frozen-source release build and native Netlify room tests are separate checks; hosted deployment identity and a player's actual rematch are separate evidence again.
