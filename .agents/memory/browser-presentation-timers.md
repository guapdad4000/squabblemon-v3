---
name: Browser presentation timers
description: Why cancellable UI timelines must wrap native browser timer functions instead of storing them unbound.
---

Pass wrapper functions such as `(callback, delay) => setTimeout(callback, delay)` into cancellable presentation schedulers; do not store `window.setTimeout` or `window.clearTimeout` directly as object methods.

**Why:** Calling a stored native timer through an object can bind the wrong receiver in Chromium. Unit tests in Node still pass, but the browser sequence stalls at its first awaited beat.

**How to apply:** Any UI presentation scheduler or fake-timer injection boundary should use receiver-safe wrappers for its production defaults and injected functions only in tests.