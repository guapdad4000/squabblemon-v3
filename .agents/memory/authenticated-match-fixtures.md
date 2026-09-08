---
name: Authenticated journey fidelity
description: Why authenticated browser mocks must preserve production request and response invariants.
---

Authenticated journey fixtures must preserve the production contract between each request and response, especially fields that choose online versus fallback behavior.

**Why:** Contract-inconsistent mocks can send the app down a valid fallback branch while leaving the previous screen visible. Route assertions then report a misleading rendering failure instead of exposing the fixture error.

**How to apply:** Derive response fields that identify mode, ownership, or selected content from the intercepted request. Assert the intended online branch before making route or presentation claims.