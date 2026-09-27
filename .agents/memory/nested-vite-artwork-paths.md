---
name: Nested Vite artwork paths
description: Why a healthy HTTP response can still be a broken image under nested Vite preview paths
---

For public assets referenced from the HTML entry, use Vite's root-absolute asset URLs and let Vite apply the configured base path. Do not concatenate `%BASE_URL%` with an asset name in an HTML URL that Vite already rewrites.

**Why:** On a nested preview, the HTML rewrite and `%BASE_URL%` substitution can both add the prefix; with an unterminated base, they can instead merge the prefix into the filename. Vite may serve its SPA fallback HTML with status 200 for either missing image URL, so an HTTP status-only browser assertion misses broken art.

**How to apply:** For nested-path browser checks, verify image response MIME type (and image decode when testing a particular rendered image) in addition to HTTP failures. Keep expected API fixtures separate from artwork failures.