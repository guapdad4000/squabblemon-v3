---
name: Card rarity identity
description: The durable boundary between catalog rarity, cosmetic card styles, and combat balance.
---

Card rarity is authoritative catalog metadata used for collection ordering, pack odds, duplicate conversion, rewards, and a consistent visual frame. It is not a cosmetic style and never changes Power, cost, or abilities.

**Why:** Players need one stable signal for collection value without mistaking a crafted appearance or a rare pull for hidden combat strength.

**How to apply:** New card surfaces must preserve the rarity frame, readable tier name, and diamond cue. Cosmetic variants render as a separate higher layer. Economy code resolves rarity from the catalog, and gameplay logic must not branch on rarity.

Battle transformations retain the original collectible identity for rarity, ownership, and progression. Their alternate artwork and form description are battle presentation, not extra collectibles.

**Why:** A powered-up portrait can have no catalog entry. Resolving rarity from that portrait instead of the original card can crash the board when the transformation succeeds. Inventing another catalog entry would also put a battle-only form into packs.

**How to apply:** Use canonical gameplay identity for collection metadata and explicit battle-form data for artwork/name/effect. Verify both local rendering and authoritative online projections whenever adding a transformation.