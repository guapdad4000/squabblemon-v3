---
name: GitHub handoff LFS transport
description: GitHub connector host boundaries, complete source-only handoffs, and verified LFS recovery.
---

Successful GitHub API writes and an initialized SDK client do not establish Git LFS upload access.

**Why:** The connected API accepted ordinary Git blobs, while the initialized client rejected the separate `github.com` LFS endpoint. Native Git also lacked write authentication. This was a transport/authentication-path limitation, not an expired OAuth connection.

**How to apply:** Check referenced LFS objects through the Batch API using each pointer's exact object ID and size. A published pointer is not proof that its payload is downloadable. Prefer an approved native Git LFS authentication path when available; never extract connector credentials into shell commands or reconnect a healthy API connection to fix a host restriction.

If native LFS upload is unavailable for a source-only handoff, an explicitly documented recovery bundle on a separate handoff branch can retain complete content without changing the frozen source tree.

**Why:** Replacing LFS pointers or attributes would alter the source snapshot. Publishing only pointers would leave other agents unable to recover tracked evidence. A compressed companion bundle preserved the original objects while the source branch retained its exact Git tree.

**How to apply:** Keep production branches and the workspace's history untouched. Publish only the needed, hash-verified objects as ordinary Git content in the companion branch. Provide immutable recovery links and instructions to clone with smudging skipped, restore the local LFS object store, and run LFS checkout. Verify the downloaded bundle and every restored file against SHA-256 IDs, not just the local package. Clearly disclose that ordinary first-time LFS downloads still require this recovery step.

Large Git tree mutations may need smaller incremental requests even after all blob uploads succeed.

**Why:** A hundreds-of-path mutation returned a server error; smaller mutations against successive unreferenced trees produced the exact target tree. Individual large blob transfers were not the blocker.

**How to apply:** Persist intermediate tree hashes and applied-path progress, then compare the final complete tree to the frozen source before creating a commit or new branch. Do not publish an intermediate tree, omit files, or change existing refs to work around an API error.

An unset Netlify `GIT_LFS_ENABLED` does not prove that repository checkout skips LFS.

**Why:** A plain Git checkout still ran its installed LFS smudge filter and failed on unavailable historical benchmark payloads before the application build started.

**How to apply:** Verify checkout with an empty LFS object store. If archival evidence is deliberately restored separately, scope the exclusion to that evidence and retain verified recovery instructions; never disable downloads for game assets just to make deployment pass.