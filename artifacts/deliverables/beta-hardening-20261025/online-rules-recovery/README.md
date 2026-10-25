# Online rules recovery — local browser verification

Final result: **4/4 passed** using the real `Multiplayer` component with app auth, query and social providers in `e2e/pvp-exit.fixture.tsx`. The fixture begins with an active engine-created room and retires it through `retireOnlineRoomForRulesUpdate`; it does not fabricate recovery HTML.

Cases: Friendly Fades at320×568 and844×390; ranked Fade Park at1440×900; Kumite at390×844. Each verifies focused retirement heading, removed active board, idempotent retirement, an actual repeated account-scoped read that does not steal button focus, zero surrender/action requests, >=44px visible action height, no horizontal overflow,7.64:1 action contrast, and exactly one full document navigation to the proper prefixed route. Old document globals disappear. Screenshots and detailed assertions are in `report.json`.

The check found and prompted three scoped production corrections by the parent agent: explicit import of existing shared button/state CSS, containing the closed scene's decorative portraits, and supplying the locally required palette tokens. Open-room layout was not changed by these corrections. Final phone and landscape captures were visually inspected.

Run from `artifacts/squabblemon` in the active checkout:

```sh
PORT=4337 BASE_PATH=/squabblemon/ VITE_E2E_AUTH=true VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZTJlLXRlc3Qk /usr/bin/node node_modules/vite/bin/vite.js --config vite.config.ts --host 127.0.0.1 --strictPort
CHROMIUM_EXECUTABLE=/usr/bin/google-chrome ONLINE_RULES_ORIGIN=http://127.0.0.1:4337 ONLINE_RULES_OUTPUT='/home/falcon/Documents/New project 9/output/beta-final-qa/online-rules-recovery' /usr/bin/node e2e/verify-online-rules-recovery.mjs
```

The runner also passes `node --check`. Temporary browser/server were closed after verification; the existing user preview was not stopped.

## Limits

The destination document is intercepted to verify navigation without loading a signed-in hub. This is not authenticated destination, real API/database, deployment, physical device, or WebGL performance evidence. OS/app reduced motion is used. No browser `pageerror` occurred. The Vite server emitted a pre-transform warning about its externally served shared Three.js module; these reduced-motion recovery cases use static alley artwork and do not establish that optional WebGL import's correctness. Native retirement/receipt transaction proof belongs to the separate API suites.
