---
name: Local release gates
description: How to run the Netlify release build gates from the workspace without production secrets.
---

Run the full release gates locally with `APP_ENV=staging PUBLIC_ORIGIN=https://squabble.today` and `DATABASE_URL` unset. Production mode demands a pk_live Clerk key that the workspace does not have; with no APP_ENV the build refuses to start.

**Why:** Three failed attempts in a row (no APP_ENV, then production, then staging without PUBLIC_ORIGIN) before the gates ran.

**How to apply:** Use staging mode for pre-push verification. Netlify's own build still enforces production settings on deploy, so check the deploy state after pushing.

Discover production JavaScript filenames from its live entrypoint and imports instead of assuming local staging chunk names remain identical.

**Why:** The same verified release tree produced different production Patch Desk and patch-renderer hashes through environment-dependent imports. Requests for their staging filenames returned 404 even though both features were correctly deployed.

**How to apply:** Use the verified Git tree and runtime deployment identity to establish release provenance. Follow the production document's actual script/import graph for feature checks; compare byte hashes only for files whose build inputs are unchanged across environments.
