---
name: Nested Vite paths
description: Trailing-slash document roots and image verification under nested Vite preview paths
---

For public assets referenced from the HTML entry, use Vite's root-absolute asset URLs and let Vite apply the configured base path. Do not concatenate `%BASE_URL%` with an asset name in an HTML URL that Vite already rewrites.

**Why:** On a nested preview, the HTML rewrite and `%BASE_URL%` substitution can both add the prefix; with an unterminated base, they can instead merge the prefix into the filename. Vite may serve its SPA fallback HTML with status 200 for either missing image URL, so an HTTP status-only browser assertion misses broken art.

**How to apply:** For nested-path browser checks, verify image response MIME type (and image decode when testing a particular rendered image) in addition to HTTP failures. Keep expected API fixtures separate from artwork failures.

Use the canonical trailing slash for the artifact root in full-document redirects and browser-server readiness URLs.

**Why:** Vite preview can return 404 for an unterminated nested base even while the server is healthy; this caused both a false test-server startup timeout and a broken sign-out destination.

**How to apply:** Distinguish router-relative route navigation from a document-level visit to the base itself. For the latter, append `/` to the normalized base and verify that exact URL.
