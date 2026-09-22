# September UI pass

- Shared compact player header: level, reputation, Clout, Safehouse return, and Express navigation. Express retains music controls.
- Shop order: Gotcha, Training, Fade Market. Existing pack and training account operations remain connected; Fade Market checkout is explicitly a device-local simulation.
- Versus arrival before a new online field, with immediate entry and reduced-motion support. The authoritative match clock continues during the short introduction.
- Reward receipts and end-of-battle numbers animate into place. District scores show signed changes, effect explanations, and sequential round recaps.
- Continue and deck actions overlay result artwork. Comeback labels are actual controls.

## Supplied scene art

The user supplied `gatcha-bg.jpg`, `fade-market-bg.jpg`, and matching segment archives. Public assets live under `assets/scenes/gatcha-bg` and `assets/scenes/fade-market`. Both preserve a centered 16:9 canvas inside a cover crop.

The archives contain cropped transparent objects, without positional metadata or object-free backgrounds. Layer positions were recovered by matching opaque pixels to the originals. `layers.json` records their original bounds. The original background always loads first, followed by optional cutouts. Pointer and scroll movement is deliberately small to avoid exposing baked-in copies behind moving objects. Lamp brightness breathes gently. Larger independent object movement will need clean background plates.

Motion stops when offscreen or reduced motion is enabled. Resize, scroll, pointer, and preference observers are cleaned up when leaving the page. The interactive gym canvas is transparent so the supplied gym shows through.

## Verification

Run a local Vite server with `PORT=4197`, `BASE_PATH=/`, and `VITE_E2E_AUTH=true`, then run `node e2e/verify-ui-polish.mjs` from the frontend directory. This checks simulated purchase accounting and reload, account isolation, 320/390/1440px layouts, reduced motion, and reachable result controls. `UI_ORIGIN` and `BROWSER_CHANNEL` can override the defaults.

See `ui-sound-direction.md` for the dedicated sound-library brief and payment handoff requirements.
