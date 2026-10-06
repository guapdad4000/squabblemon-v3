# Fadecade games artwork

Generated with the built-in OpenAI imagegen tool. Exported as WebP with alpha preserved; Sharp crops the sprite atlases into independent runtime assets.

Only clenched fists are Squabblemon emblems. Never use crowns.

Girl Fade uses the existing `assets/fadecade/girl-fade.webp` cabinet, which already has the correct title. Fade Market and Block Takeover are edits of the existing Daily and Weekly cabinets: retain their distressed blue/white and red/black frame designs, respectively; correct only the marquee titles and subtitles, and replace crown emblems with fists.

`girl-stage`: empty pink and teal underground women's boxing ring, over-the-shoulder camera, custom neon fist emblems. `girl-0/1/2`: Bonnet Girl, Bottle Girl, Baby Momma. Front/back guard portraits are idle poses only. `attack-front` punches toward the camera as the opponent. `attack-back` punches away from the camera toward the opponent, looking forward with the back of the head visible. Never turn the attacking player back toward the viewer.

`market-stage`: overhead Fade Market, four stocked shelves making five clear lanes, entrances at top, checkout below. `market-doctor/punch`: Dr. Fade, white shirt, vest, green tie, blond hair, glasses. `market-cashier/restock`: Night Cashier, dark hoodie and red apron, carrying/restocking crates. `market-yn-0/1`: masked navy and red hooded enemies seen from above.

`block-stage`: top-down nine-district city grid with gym, blacktop, depot, subway, function, market, safehouse, park and warehouse.

`impact-gold/counter/hit/slip`: transparent anime punch bursts, teal counters, red hit flashes and pink slip streaks.

Source generation session: 01a100f0-8534-7ca0-aba4-dd3d544227ef. Corrected action atlas: exec-b65aca3f-bd71-4d8c-a8fa-cc3e8d30ec59.png. Cabinet edits: exec-94ee446b-d409-4713-8fbb-637d1c73e59a.png and exec-2dcbb145-7a81-4d23-8593-3b58b2702ff0.png. Original discarded cabinet redesigns are not installed.

## Complete direction-specific combat poses

24 runtime poses: each of Bonnet Girl (0), Bottle Girl (1), and Baby Momma (2) has `front/back` views for `jab-left`, `jab-right`, `uppercut`, and `duck`. Left and right jabs use different anatomical arms; do not horizontally flip an entire character to fake the second punch. Opponent telegraphs display the corresponding front pose. Player inputs and resolved exchanges display the matching rear pose. Down input is a compressed guard crouch. Corrected atlases: exec-4cbf399d-bdcf-4cc2-852e-7260f7decd24.png, exec-9b7a0e2c-e38b-4a12-bd27-0ce640266c13.png, exec-061381a9-fb70-4bcd-853b-6a29dbe9c4fa.png.

`market-doctor-north` and `market-punch-north` replace upward-camera-facing gameplay poses: camera over Dr. Fade's back, face aimed at aisle enemies north, straight punch parallel to the floor toward the top of the screen. Source exec-d704d579-5d17-4438-b5b3-ca914e80adcd.png. Initial front-facing portrait is only used in the introductory character billing.

Final rear left-jab camera corrections keep the nose and gaze facing the same upper-right opponent as the right jab. Installed from exec-caf404ec-4641-457e-a8c5-e7fb656840a6.png, exec-5a355c9b-2404-4a27-be22-935037355ad6.png and exec-22b0171b-b0b3-4f3b-8969-b98c43e8f9bc.png (bottom second cells only).

## Graphics placement audit - 2026-10-06

Girl Fade now uses a fixed close sparring window: 390px desktop, 320px phone. Far ropes remain behind the fighters; both torso cutoffs continue below the clipped camera edge. Pattern controls sit underneath the fight. Guard portraits have square canvases and action portraits have 3:4 canvases, so their separate rendered heights preserve comparable shoulder and head scale. Ducking lowers the player naturally; it does not move the player outside the ring.

All 24 action cells and six guard cells received imagegen transparency cleanup. Cleaned action atlases: exec-19d98cac-8c7a-4bfa-aea6-1b0e58c58aac.png (Bonnet), exec-4fa02dba-920d-42f7-aee5-bcc603f82776.png (Bottle), exec-f2a9b5d7-4d68-4f67-84ba-fd860733d606.png (Baby Momma). Guards: exec-67ebbcfb-4ddc-4f71-9c4b-a17e4aa907e6.png. Mean faint alpha (1-31) dropped from 20.6% to 4.4% across action cells; remaining translucent hair/antialias edges are retained. Mean occupied perimeter pixels dropped from 463 to zero; lower-body cutoffs are deliberately hidden by the camera rather than painted into legs.

Close ring: exec-0d8e04c4-9e53-4389-84e5-0d8702cb66ef.png. Illustrated bilingual counter, hit, slip, KO, wave and power callouts: exec-83a7af21-744a-4d74-a064-7f1b31ad2bbb.png. Individual transparent PNG exports are included alongside WebP runtime versions. Japanese lettering is decorative; English labels and actual damage values remain accessible. Only fists, never crowns.

Dr. Fade north guard and punch share a crop and source scale, with complete punch reach preserved. Empty atlas padding no longer makes him smaller than the enemies. The hero is rendered at 23% scene height on desktop and 22% on phone, with feet above the stock controls. The north-facing attack remains parallel to the market lanes.

Verification: `pnpm --dir artifacts/squabblemon run test:arcade-browser` exercises the actual client at 1440x1000 and 390x844 with controlled API fixtures using the shared rules engine. It asserts fixed camera dimensions, hidden torso cut edges, controls below the fight, all four directional poses, loaded assets, saved-state continuity, and no document reloads. Final captures are in `screenshots/arcade-games/`.

Final isolated action atlases supersede the cleanup sources above: Bonnet exec-e4b85e0a-8d5d-4ab3-b637-39ea07f6bbd8.png, Bottle exec-54ee7830-1862-47cc-8bc7-67007f5ddd92.png, Baby Momma exec-b3462f3b-2d9f-450e-9daf-d72f99d50cdb.png. Runtime exports crop 20px horizontal and 12px vertical cell gutters, then restore equal transparent padding. This prevents neighboring fragments while preserving the 384x512 frame dimensions and camera alignment. The full-body Bonnet generation was rejected to preserve the established close torso framing.

Additional browser assertions measure actual alpha silhouettes, verify Dr. Fade is at least enemy scale and remains above stock controls, and capture the illustrated power-up event. Production build and client TypeScript checks pass.
