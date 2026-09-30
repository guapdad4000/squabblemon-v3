---
name: Render-test environment
description: Keep test environment fixes out of production and browser callbacks independent of Node transpiler helpers.
---

When a Node rendering test imports a browser-only dependency, supply its Vite environment in the test harness instead of weakening production routing or authentication.

**Why:** A post-match social control expanded an existing battle test's import graph into authentication and routing. Browser journeys and typechecks passed, but the release's Node markup gate failed because Vite's environment was absent. Runtime fallbacks would hide configuration errors in the actual app.

**How to apply:** Use production-shaped test flags with development authentication disabled and no real credentials. Check the canonical release build when component imports expand; passing browser tests alone does not cover Node rendering imports.

## Self-contained browser callbacks

In browser tests loaded through tsx, avoid locally defined function helpers inside a serialized `page.evaluate` callback, including assigned arrows and named function expressions passed to Promise constructors. Object methods remain self-contained.

**Why:** tsx can preserve function names by injecting a Node-side `__name` helper. That helper is absent in the browser, so an otherwise valid geometry assertion can throw before checking any UI.

**How to apply:** Use object methods for local browser-side geometry helpers, or serialize plain JavaScript explicitly. Even a named Promise timeout callback can inject the missing helper. Check the callback's serialized source when diagnosing this error; do not add a production browser polyfill.