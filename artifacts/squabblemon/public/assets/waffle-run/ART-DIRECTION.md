# Squabblehouse Waffle Run

Generated with the built-in OpenAI image generation tool, then exported with Sharp to WebP. No third-party game sprites.

Art direction: warm nighttime inner-city diner, deliberate low-resolution pixel clusters, amber bulbs, teal vinyl seats, red tile, six round tables in two rows of three, no interface baked into the background. The playable bird follows the existing Innercity Pigeon artwork: gray pigeon, black knit ski mask, orange eyes and feet, iridescent green-purple neck.

Generated assets:
- `diner.webp`: landscape pixel diner background, empty tables at 20/50/80 percent across, two rows.
- `pigeon-{idle,hop,attack,back,syrup,hurt}.webp`: six transparent pixel sprite poses, exported from a 3-by-2 generated atlas.
- `staff-{0,1,2,3}.webp`: bus boy, cashier, cook, and security, with readable silhouettes and expressive battle poses.
- `plate-{waffle,empty}.webp`: transparent waffle plate and cleared plate props from the staff atlas.
- `cabinet.webp`: custom teal, cream and red countertop arcade cabinet, waffle emblems, joystick, coin slot, WAFFLE RUN marquee and dark CRT window.

Gameplay: two starts per UTC day; leaving pauses the saved run. Health carries between battles. Watched plates and rising attention trigger encounters. Choose one of three new moves before each encounter; keep up to four, with Peck always available. Opponent health and damage grow with wins. Limited move uses refill per fight.

Rewards bank after every saved action: 20 Clout per three waffles plus 25 per battle win, capped at 600 per run; tickets at 12 and 30 waffles; three Style Shards every two wins, capped at 18 per run. Death and early retirement keep banked rewards. Server-owned state, revision checks, transaction locks and action retries prevent duplicate payments.

## Cabinet revision 2

`cabinet-v2.webp` replaces the countertop machine with a front-facing illustrated Fadecade frame, based on the supplied Straight to the Back and four-machine cabinet references. Generated with built-in OpenAI image generation, exported at 1200×800 with alpha preserved. Direction: explosive WAFFLE RUN marquee, SQUABBLEHOUSE subline, amber/teal/crimson mechanical armor, diner checkerboard stickers, pigeon and waffle motifs, two illuminated speakers, blank dark screen. The screen receives a live diner preview and accessible launch control. Original generation: `exec-614443c7-8002-41bb-af54-8aae065ee893.png`.

## Mandatory emblem rule

Never crowns. Only clenched fist emblems. This applies to marquee marks, badges, decorative stickers, waffle stamps, and all future Squabblemon artwork. References containing crowns are style references only; every crown must be replaced with a fist in the final output.

Cabinet revision 3: `cabinet-v3.webp`, edited with the built-in image tool. Prompt: replace every crown with a clenched fist, preserving all other artwork, text, aperture geometry and transparency. All four marks (top marquee, lower badge, right sticker, right waffle stamp) were visually checked. Source: `exec-26279665-9e74-48b1-a971-1414d7e30788.png`.
