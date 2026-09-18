# Combat sprite pack

Created 2026-09-17 with the built-in image-generation tool. Five independent transparent PNG masters and optimized WebP runtime sprites.

## Files

Runtime sprites: `public/assets/combat/`.
Full-size originals: `reference/combat-art-masters/`.
Interactive preview: `e2e/combat-art.fixture.html` (serve through Vite).

| File | Use | Runtime width |
| --- | --- | --- |
| fight-start-burst.webp | Versus, countdown, Squabble and crew-up callouts; live text over the art | 1000px |
| defeat-slash.webp | Two independently revealed strokes form the defeated-card X | 400px |
| lock-chain-strand.webp | Two crossing restraints and release fragments | 600px |
| lock-padlock.webp | Lock closes after chains arrive; drops away on release | 192px |
| freeze-rim.webp | Hollow ice edge around the readable card portrait | 300px |

Runtime total: 286,228 bytes. Transparent margins are trimmed and exports resized; the original generated alpha is preserved. PNG masters are unmodified.

## Integration

BattleArt supplies the reusable sprites, preload hints, fight-start composition and defeat cross.
BattleStatus uses the chain, padlock and ice artwork.
BattleAttack adds the cross only for authoritative destruction and releases restraints when the corresponding status ends.
Existing round artwork, timing, skip actions, replay state, status badges and gameplay rules are preserved.
Animations are finite. System and in-game reduced-motion preferences suppress movement while keeping persistent restraints readable.

## Generation prompts

### fight-start-burst

Use case: stylized-concept. Production transparent game VFX sprite for Squabblemon, a gritty street-fighting collectible card game. Style: hand-painted cel-shaded premium game artwork, broad strong shapes, worn antique gold, deep charcoal contours, restrained crimson accents, warm top-left edge highlights, readable at small sizes. Genuinely transparent RGBA background with clean alpha edges. No checkerboard, no presentation sheet, no mockup, no environment, no text, letters or watermark. ONE standalone usable sprite. Subject: a dramatic horizontal impact burst, like two fighters colliding. A wide jagged sweep of charcoal ink and brushed bronze-gold shards with short crimson speed streaks fanning outward to the left and right; an open but dark charcoal painted area at the center reserved for live large text. Not a rectangular plaque or button. A punchy irregular silhouette, energetic broad graphic impact spikes, minimal detached specks. Width-to-height 2.3:1 on a wide canvas; sprite fills most of the canvas with a little clear margin. This will expand sharply behind the word SQUABBLE and a fight emblem; do not draw any lettering or gloves.

### defeat-slash

Use case: stylized-concept. Production transparent game VFX sprite for Squabblemon, a gritty street-fighting collectible card game. Style: hand-painted cel-shaded premium game artwork, broad strong shapes, worn antique gold, deep charcoal contours, restrained crimson accents, warm top-left edge highlights, readable at small sizes. Genuinely transparent RGBA background with clean alpha edges. No checkerboard, no presentation sheet, no mockup, no environment, no text, letters or watermark. ONE standalone usable sprite. Subject: ONE single long horizontal crimson cross-out slash, an aggressive broad dry-brush paint stroke with a narrow worn antique-gold highlight along one edge and heavy charcoal outline. Red paint, not blood. Left-to-right straight horizontal orientation, longest axis perfectly horizontal, width-to-height about 7:1. Tapered pointed ends, ragged brush texture but solid readable core. This will be rotated in code and layered twice into a defeated-card X; draw only ONE straight stroke, not an X or multiple strokes. Wide canvas, minimal transparent margin, no curved swoosh, no glow fog or particles.

### lock-chain-strand

Use case: stylized-concept. Production transparent game VFX sprite for Squabblemon, a gritty street-fighting collectible card game. Style: hand-painted cel-shaded premium game artwork, broad strong shapes, worn antique gold, deep charcoal contours, restrained crimson accents, warm top-left edge highlights, readable at small sizes. Genuinely transparent RGBA background with clean alpha edges. No checkerboard, no presentation sheet, no mockup, no environment, no text, letters or watermark. ONE standalone usable sprite. Subject: ONE straight horizontal taut industrial chain strand, 10 chunky interlocking oval steel links with dark gunmetal interiors, scratched brass edges and warm gold highlights. Alternating face-on and edge-on links, mechanically connected and unmistakably a chain. Straight-on orthographic game prop view, perfectly level horizontal line. Entire strand visible, no cut-off links, ends flat with closed links. Wide canvas, width-to-height about 8:1, tightly framed. No padlock, no badge, no crossing or looping chain, no detached pieces, no scenery, no glow haze. Intended to slide diagonally across a card as a locking restraint.

### lock-padlock

Use case: stylized-concept. Production transparent game VFX sprite for Squabblemon, a gritty street-fighting collectible card game. Style: hand-painted cel-shaded premium game artwork, broad strong shapes, worn antique gold, deep charcoal contours, restrained crimson accents, warm top-left edge highlights, readable at small sizes. Genuinely transparent RGBA background with clean alpha edges. No checkerboard, no presentation sheet, no mockup, no environment, no text, letters or watermark. ONE standalone usable sprite. Subject: ONE compact heavyweight padlock, front view. Squat charcoal-black forged steel body with beveled antique-brass corners, thick gold-edged dark steel closed U-shaped shackle, one clear central keyhole in the warm brass inset. Minimal engraved diagonal scratches, tiny crimson accent under the keyhole. No letters or logos. Strong iconic silhouette, recognizable at 24 pixels. Centered square canvas, object fills 85 percent. No chains attached, no backing plate, no round badge, no cast shadow outside the object.

### freeze-rim

Use case: stylized-concept. Production transparent game VFX sprite for Squabblemon, a gritty street-fighting collectible card game. Style: hand-painted cel-shaded premium game artwork, broad strong shapes, worn antique gold, deep charcoal contours, restrained crimson accents, warm top-left edge highlights, readable at small sizes. Genuinely transparent RGBA background with clean alpha edges. No checkerboard, no presentation sheet, no mockup, no environment, no text, letters or watermark. ONE standalone usable sprite. Subject: ONE hollow ice-crystal rim for a portrait game card, width-to-height ratio 0.716:1. Translucent pale cyan and icy white faceted shards gripping the four edges and corners of a tall rectangular opening; asymmetrical naturally fractured ice, dark ink-cut contours, tiny worn warm bronze inclusions only at the far outer corners. The center 75 percent must be completely empty and transparent so a card portrait remains fully visible. No solid frosted pane in the center, no opaque interior, no lettering, no character, no chains or padlock. Crisp chunky shard silhouettes, no fine hairline texture. Entire perimeter and tips visible with clear transparent margin. Front-on orthographic sprite.
