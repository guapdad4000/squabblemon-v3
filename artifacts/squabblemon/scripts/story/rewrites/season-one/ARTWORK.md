# Season One rewrite artwork

The user's supplied RGBA figures override the handoff's neutral shadow brief.
`player.webp` uses the side/profile image for speaking and final-speaker
completion portraits. `player-rear.webp` uses the rear image as a listening
pose after Player has entered the scene. Both are proportionally resized to
1,200 pixels high and encoded as lossless WebP. No dark body pixels are removed,
no face is added, and no background-removal operation is applied to either
supplied image.

Byte-identical originals are retained in `reference/story-player/side.png` and
`reference/story-player/rear.png`, so release checks do not depend on transient
uploads being present in a deployment checkout.

Contrast comes from CSS light behind the figure and an outer rim shadow, not
recoloring or replacing the original body artwork. The alpha/pixel preservation
test compares the decoded portraits to the proportionally resized uploads.

Rae is a single new illustrated supporting portrait: the Player's cousin,
holding the two plates described in her delivered doorway entrance. Her casual
clothes and illustrated treatment support the existing cast; she has no new
subplot, playable card, unlock reward, or pack entry. The generated reference is
`attached_assets/generated_images/rae-season-one.png`; the optimized transparent
runtime cutout is `assets/characters/rae.webp`.

The three portrait cache revisions live in a small presentation-only manifest.
Shared reward UI must not import the story catalog to resolve this artwork.