---
name: Authenticated journey fidelity
description: Why authenticated browser mocks must preserve production request and response invariants.
---

Authenticated journey fixtures must preserve the production contract between each request and response, especially fields that choose online versus fallback behavior.

**Why:** Contract-inconsistent mocks can send the app down a valid fallback branch while leaving the previous screen visible. Route assertions then report a misleading rendering failure instead of exposing the fixture error. A broad match-room interceptor can also accidentally return a room response for an auxiliary endpoint such as reactions, causing a mounted battle to crash after its initial render.

**How to apply:** Derive response fields that identify mode, ownership, or selected content from the intercepted request. Match auxiliary endpoints before broad room routes and return their own response contracts. Assert the intended online branch before making route or presentation claims.

Do not assume bringing a headless browser tab forward causes a background query refetch.

**Why:** Headless Chromium did not emit the visibility change expected by React Query during cross-session profile tests. A passing reload test alone did not prove that an unsaved draft survived an actual background response.

**How to apply:** For focus-refetch tests, trigger the running query library's focus manager when native visibility events are unavailable, then await the actual network response before asserting draft retention or clean-form adoption. Keep this mechanism in the test harness, not production code.