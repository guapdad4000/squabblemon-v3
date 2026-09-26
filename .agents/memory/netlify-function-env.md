---
name: Netlify function environment
description: netlify.toml env vars never reach function runtime; NETLIFY is a reserved key; env changes apply at deploy time.
---

Variables declared in `netlify.toml` (including `[context.*.environment]`) are build-only; Netlify Functions never see them. `NETLIFY` is a reserved key that cannot be set manually, and it is also absent from function runtime — only `URL`, `SITE_NAME`, and `SITE_ID` are provided there. Function env changes via UI/API apply at deploy time, so a new deploy is required after changing them.

**Why:** The live payments gate checked `process.env.NETLIFY === 'true'` and `process.env.APP_ENV === 'production'`; both were absent in function runtime, so live checkout silently stayed disabled with "Live payments await merchant and policy approval" even though every configured flag was correct.

**How to apply:** For function-runtime gating, trust the per-invocation deploy context (`context.deploy.context`, `deploy.id`, request origin via the runtime deployment context wrapper) and site-level env vars set through UI/API. Treat `process.env.CONTEXT`/`APP_ENV` as optional belts ("absent or production"), never as required function-runtime signals. Verify paid flows on the live site after any gate change.
