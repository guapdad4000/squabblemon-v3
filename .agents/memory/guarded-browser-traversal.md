---
name: Guarded browser traversal
description: Navigation invariant for protecting dirty route state across in-app links and browser history controls.
---

Dirty-route protection must intercept both router-driven pushes and browser history traversal. Browser entries need a monotonic index so a guard can restore and later continue either Back or Forward in the correct direction; treating every `popstate` as Back breaks Forward.

**Why:** A local back-button guard protected one exit but global navigation links bypassed it, while a directionless `popstate` fallback restored the wrong entry during Forward traversal.

**How to apply:** Route all in-app navigation through the shared router guard, preserve an index in history state for pushes and replacements, and test save/discard/stay decisions for global links, Back, and Forward.