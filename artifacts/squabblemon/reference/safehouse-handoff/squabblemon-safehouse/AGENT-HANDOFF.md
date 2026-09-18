# Handoff to the Squabblemon app-building agent

## Task

Integrate this approved safehouse into the existing Squabblemon app while preserving its visual direction and working interactions. Use the supplied Three.js source and real 3D geometry. Treat it as the game's home-room environment.

## Preserve the approved design

- Bold black silhouette and corner outlines on the actual 3D objects.
- Banded anime lighting, violet shadows, subtle halftone in shaded materials, bright gold reflections.
- Burgundy tufted couch, concrete/plaster and exposed brick, wood floor, patterned rug, barred window, kitchen nook, crown pendant, plants and gold records.
- Gold domino table, gold-edged deck of cards, separate cellphone table and hanging leather punching bag.
- The TV as the story-mode progress display.
- Responsive close-up cameras, tapping/picking, punch animation and day/night lighting.
- Black borders, hard offset shadows and gold active states in the UI.

The inspiration is an anime/arcade fighting game. Keep the Squabblemon identity; no Capcom logos or character assets are included.

## Fastest integration: a dedicated same-origin page

Copy the contents of `app/` into a static directory such as `public/safehouse/`, preserving their relative paths. Serve `/safehouse/index.html` as its own page, or place that URL in a full-size same-origin iframe. The iframe isolates the global CSS, DOM IDs and window-sized canvas.

After the frame loads, pass the actual campaign state:

```js
const frame = document.querySelector('#safehouse-frame');
frame.addEventListener('load', () => {
  const api = frame.contentWindow?.Squabblemon;
  if (!api) return; // Surface a loading/error state in the host app if necessary.

  api.setStoryProgress({
    demo: false,
    chapter: save.currentChapter,
    totalChapters: campaign.chapters.length,
    title: campaign.chapters[save.currentChapter - 1].title,
    completedChapters: save.completedChapterIds.length,
    objective: save.currentObjective,
    wins: save.blockWins,
    targetWins: save.blockWinTarget
  });
});
```

`save` and `campaign` above represent the host app's real data; adapt those names to its schema. Keep the frame mounted and call the setter again when progress changes. The API exists after the module initializes. There is no built-in cross-origin `postMessage` bridge.

## Story display contract

```js
window.Squabblemon.setStoryProgress({
  demo: false,
  chapter: 1,
  totalChapters: 7,
  title: 'THE BLOCK IS HOT',
  completedChapters: 0,
  objective: 'Win your first showdown',
  wins: 0,
  targetWins: 10
});

const current = window.Squabblemon.getStoryProgress();
```

The example above describes a new-game save. Replace it with the player's actual state. The setter replaces the display state; it is not a partial-update/merge API. Send all fields on every update.

| Field | Meaning and normalization |
| --- | --- |
| `demo` | Only literal `true` displays DEMO SAVE; otherwise CAMPAIGN. |
| `chapter` | One-based current chapter; integer clamped to 1–totalChapters. |
| `totalChapters` | Integer clamped to 1–50. |
| `title` | Chapter title, limited to 48 characters. |
| `completedChapters` | Integer clamped to 0–totalChapters. |
| `objective` | Current objective, limited to 100 characters. |
| `wins` | Integer clamped to 0–targetWins. |
| `targetWins` | Integer clamped to 1–999. |

Campaign percentage is `round(completedChapters / totalChapters * 100)`. Block wins are displayed separately and do not contribute to that percentage. No save is written by this API.

## Native component integration

The current implementation is vanilla JavaScript ES modules, with one scene instance initialized at module load. It is not yet a React component or a scene lifecycle factory.

For a native React, Vue or other component integration:

1. Move setup into a `createSafehouse(container, options)` lifecycle function. Scope all queries to that container and guard against duplicate initialization.
2. Replace `innerWidth`/`innerHeight` assumptions with the container's bounds. Update renderer dimensions, camera aspect and pointer coordinates together; use a ResizeObserver for a resizable host.
3. Namespace `style.css` beneath the component root. It currently styles body, header, footer, button, dialog and canvas globally.
4. Preserve required DOM IDs from `index.html`, or refactor the DOM references coherently. Story panel elements must exist before `drawStory()` runs.
5. On unmount, cancel the animation frame, remove pointer/window listeners, dispose the art pass, renderer, scene environment, all geometries, materials and generated textures, and remove the canvas. `art.dispose()` currently disposes the postprocessing resources only; it is not a whole-room teardown.
6. If using npm Three.js, initially pin `three` to `0.180.0` and update imports in BOTH `scene.js` and `art-direction.js` together. The cel effect patches r180's physical shader source. Validate any later Three.js upgrade against that patch.

## Render pipeline

`installFightingGameStyle({ renderer, scene, camera, screenMaterials })` returns `render()`, `resize()`, `dispose()` and `styledMaterialCount`.

The pipeline renders:

1. The colored scene into a half-float render target.
2. Normals plus depth into a second render target, excluding transparent helpers and particles.
3. A full-screen composite that draws ink at depth/normal discontinuities and applies tone mapping/output color conversion once.

Material shader edits create the cel bands and shaded halftone. The CRT material bypasses those edits to preserve progress text. The cellphone uses an unlit screen texture. Keep `art.render()` in the frame loop and `art.resize()` after renderer size changes. New standard/physical materials added AFTER art installation will need the style installer refactored to register them.

This is a WebGL2 renderer. Check half-float render-target support and memory/performance on the app's actual devices. Pixel ratio is capped at 1.4 on narrow screens and 1.7 otherwise; the room contains approximately 587 meshes. If needed, batch repeated props or reduce render-target resolution while preserving visible outlines.

## Current interactions and connection points

| Destination | Current implementation | App integration |
| --- | --- | --- |
| Story mode / TV | Focus camera, display panel and textured TV progress | Connect real campaign state via the public setter. Add campaign launch behavior where the app requires it. |
| Heavy bag | Focus camera; tap or Hit the bag triggers damped swing | Attach training systems if the game already has them. No combat rewards or XP are currently awarded. |
| The deck | Focus on the gold-edged deck and face-up fan | Connect to the app's real deck system if intended. No deck editor is included. |
| Cellphone | Focus on a decorative phone screen | Connect app-owned phone functions if intended. No messaging system or live notifications are included. |
| Room / table / lounge | Camera presets | Preserve as navigation options or map them into existing room controls. |

`view(name)` and `punch()` are module-local functions in `scene.js`; they are not presently public methods. View names are `room`, `table`, `lounge`, `story`, `training`, `cards` and `phone`. Both station buttons and object picking call the same view logic.

## Validation status and acceptance checks

Completed before this handoff: JavaScript syntax checks, local imports/assets and DOM bindings, progress normalization checks, mocked scene assembly with finite geometry, all camera destinations, story display updates, shader insertion-point checks and render-pass state restoration. The site was deployed successfully. These checks did not include actual GPU shader compilation or visual browser QA.

In the destination app, verify that the ink/cel shaders render correctly on desktop and mobile, all objects remain visible, TV text updates with real saves, drag/tap/pinch do not conflict, reduced motion is respected, repeated mount/unmount does not leak resources, and existing app navigation remains usable. Keep demo progress labeled until real game state is connected.
