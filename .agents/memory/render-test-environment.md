---
name: Render-test environment
description: Keep browser environment emulation in the Node rendering harness, not production routing or authentication.
---

When a Node rendering test imports a browser-only dependency, supply its Vite environment in the test harness instead of weakening production routing or authentication.

**Why:** A post-match social control expanded an existing battle test's import graph into authentication and routing. Browser journeys and typechecks passed, but the release's Node markup gate failed because Vite's environment was absent. Runtime fallbacks would hide configuration errors in the actual app.

**How to apply:** Use production-shaped test flags with development authentication disabled and no real credentials. Check the canonical release build when component imports expand; passing browser tests alone does not cover Node rendering imports.