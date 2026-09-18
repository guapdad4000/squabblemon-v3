# Squabblemon — The Safehouse

Complete, editable Three.js source for the approved safehouse with black ink outlines, anime cel shading, violet shadows, burgundy leather, gold furniture and arcade controls.

Start with **AGENT-HANDOFF.md** if you are integrating this into the Squabblemon app.

## Run it

From this folder, serve the app using Python 3:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory app
```

On Windows, use `py -m http.server 8000 --bind 127.0.0.1 --directory app`.

Open http://localhost:8000 in a WebGL2-capable browser. Serve over HTTP; double-clicking index.html does not reliably load JavaScript modules. Any static web server also works. No build step, npm install, API key or backend is needed to run this standalone room.

## Included

- `app/index.html` — complete room interface and required DOM elements.
- `app/scene.js` — procedural geometry, furniture, props, lighting, camera, picking and animations.
- `app/art-direction.js` — cel-shading material edits, normal/depth outline pass, color compositing.
- `app/story.js` — demo save, input normalization, campaign percentage calculation.
- `app/style.css` — responsive arcade UI and font declarations.
- `app/three.module.js` and `app/three.core.js` — bundled Three.js r180 / 0.180.0; keep both files together.
- `app/concept.png` — original vertical interior concept, available through the Concept button.
- `licenses/THREE-LICENSE.txt` — Three.js MIT license.
- `AGENT-HANDOFF.md` — integration contract, current behavior and remaining app connections.
- `CONTENTS-SHA256.txt` — checksums for the packaged files.

## Controls

Drag to rotate; scroll or pinch to zoom. Station buttons and tapping the corresponding objects select Story mode, Heavy bag, The deck or Cellphone. Hit the bag animates the punching bag. Camera buttons return to the room, domino table or lounge. Golden hour / Late night changes the lighting. The canvas supports arrow keys and plus/minus for camera control. Escape returns to the room; the concept dialog has its own Escape behavior.

## Current state

The story display starts with clearly labeled demo progress. The public `window.Squabblemon.setStoryProgress(...)` hook updates both the television texture and the story panel. There is no campaign engine or save persistence in this room. The punching bag is an interactive visual prop; the cards and phone provide close-up views.

The room geometry and material textures are built in JavaScript. There are no missing GLB, FBX or external 3D assets. Google Fonts is the only external runtime request; CSS includes fallback fonts. Self-host those fonts in the destination app if it must run fully offline.

This package reproduces the final approved ink/cel art pass from September 8, 2026. The app files match source revision `9b35eee4baa2300397d52534e58388c2ef23b5f9` byte for byte. Hosting configuration and Git metadata are intentionally excluded so this package can be reused independently.
