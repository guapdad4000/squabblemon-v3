---
name: Service worker caching rules
description: What the offline shell service worker may cache and why
---
Cache-first only for content-hashed build files; unversioned public art (incl. under /assets/) must be stale-while-revalidate; never cache /api or navigations beyond network-first shell.
**Why:** public/assets holds unversioned artwork and scene manifests; cache-first there traps returning players on old art across deploys.
**How to apply:** bump VERSION in sw.js when changing strategy; SW only registers on production root deploys.
