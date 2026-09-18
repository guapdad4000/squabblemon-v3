---
name: Preview banner geometry
description: How to distinguish real viewport clipping from the Replit development preview banner.
---

For full-viewport game screens, do not treat development-preview bounding boxes as production geometry when the Replit banner is active. Confirm edge controls against a production Vite preview with the same tablet viewport.

**Why:** The development banner can shift the app root downward while the app still uses a full dynamic-viewport height, making bottom controls appear clipped even when the production build fits exactly.

**How to apply:** Use the normal development workflow for iteration, but run the built app with the Vite preview server and measure the arena and edge-control bounding boxes before diagnosing or fixing viewport overflow.