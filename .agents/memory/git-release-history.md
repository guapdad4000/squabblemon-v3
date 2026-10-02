---
name: Git release history
description: Preserving external release history when workspace checkpoints use different commit ancestry.
---

Treat the current GitHub branch as the release parent, rather than assuming the workspace checkpoint branch can fast-forward it.

**Why:** Workspace checkpoints and GitHub releases have contained the same application state under different commit histories. The workspace also retained temporary debugging files that were intentionally absent from the release.

**How to apply:** Fetch the remote, compare actual file content, and preserve remote history. If ancestry differs, create a release commit from the remote parent with only the verified changes; compare the resulting application content with the tested workspace and use a non-forced reference update.

Check the remote history before declaring a referenced asset absent from the project.

**Why:** Recently pushed character artwork was present on the GitHub branch but not in the active workspace snapshot; a local asset scan alone falsely suggested it did not exist.

**How to apply:** When the user points to a pushed commit or agent-created media, compare the remote branch and workspace tree first. Bring over only the relevant verified assets and catalog changes; avoid replacing unrelated local work.

Verify the production provider's configured repository before choosing a release target; similarly named GitHub repositories are not interchangeable.

**Why:** A successful push to a different, similarly named repository was mistakenly described as a live-site release. The live site continued serving the old version.

**How to apply:** Confirm the provider-bound repository and branch from project documentation or deployment metadata, then verify the resulting provider deploy references the new commit before claiming the site updated.

If production main advances during release preparation, rebuild the candidate from its new parent and merge overlapping files instead of publishing the old tree.

**Why:** An independent cosmetics release landed while a gameplay update was being verified. Replacing an overlapping banner file from the local workspace would have silently removed the new cosmetics behavior.

**How to apply:** Compare the selected candidate against the latest production branch, preserve remote-only changes in shared files, and check the final tree and non-forced reference update against the new parent. Tests run solely on a divergent local workspace do not cover merged integration code.

Use Replit's connected GitHub API for this project's release operations; do not require CLI login as the deployment-access prerequisite.

**Why:** The owner explicitly confirmed this API-based workflow. Command-line Git authentication and the connected integration can also have different credential health.

**How to apply:** Use the integration's credential-injecting API to inspect and update the release branch and inspect deployment statuses. Distinguish GitHub-triggered Netlify deployment from separate permission to manage Netlify environment settings. Do not extract OAuth credentials into shell commands or assume the integration needs reconnecting because CLI authentication is absent.

Use file-backed JSON for complete Git tree comparisons. Do not rely on tab separators or large shell output surviving tool transport, and sanity-check an unexpectedly empty diff.

**Why:** Removed tab delimiters made a parsed tree comparison falsely report no differences, which hid unpublished dependencies. A large JSON tree listing also arrived as a truncated tail despite a raised shell output budget. Returning a complete GitHub tree across the impure boundary can exceed the execution ledger's per-entry limit even when console output is filtered.

**How to apply:** Parse Git's NUL-delimited output inside the shell process, save full trees to temporary JSON files, and return only the comparison summary. For large API trees, write the file inside the impure function and return only its path, commit/tree hashes, and entry count. Verify entry counts and compare the complete candidate application tree against the tested workspace, not just the selected changed files, before updating a remote branch.

If Git fetch succeeds but HTTPS push rejects the workspace credential, transfer the verified release through the connected GitHub API: upload missing binary blobs, create a tree on the current remote base, and require its SHA to equal the tested local tree before creating the remote-parent commit. Advance `main` with `force: false`; keep the original workspace branch intact and check out the newly fetched remote commit.

**Why:** Read access and write authentication can differ. The API route preserved the newer GitHub parent without extracting credentials, while a tree-SHA comparison proved the uploaded release was byte-for-byte the one that passed validation.

**How to apply:** Use this only after confirming the remote parent has not moved. A successful GitHub update does not prove the Git-triggered Netlify deployment succeeded; check that provider separately.

When every changed blob is valid UTF-8, GitHub's tree API can accept changed paths with inline `content` against the remote base tree in one request; compare the returned tree SHA to the verified local tree before creating a remote-parent commit and advancing `main` without force.

**Why:** Uploading many blobs concurrently through the connector hit HTTP 429, while a single inline-content tree request reproduced the exact local tree. This avoids exposing credentials to Git and preserves remote ancestry when local checkpoint history diverges.

**How to apply:** First confirm all changed files round-trip as UTF-8 and include deletions explicitly. Keep binary blobs on the separate blob-upload path. Check the remote ref again before the update, reject a moved ref, then fetch the result and compare tree SHAs before aligning the local branch.
When remote `main` is an ancestor of local commits that are unsigned, recreate each commit through the GitHub API with the same tree, parent, message, and author/committer names, emails, and timestamps. GitHub then returns identical commit SHAs, so local and remote history match and no realignment is needed.

**Why:** Reproducing the commit objects exactly avoids the squashed-commit divergence and backup branches that the tree-only method creates.

**How to apply:** Read the metadata from `git cat-file commit`, confirm there is no `gpgsig` header and the timezone is UTC, and compare each returned SHA to the local SHA before the non-forced ref update.

Run the Netlify build's own test gates (`scripts/build-netlify.mjs`) locally before pushing to `main`; root typecheck and focused API tests do not cover them.

**Why:** A push that added four story-earned cards failed the hosted build on hard-coded catalog counts and a Season One save-compatibility fingerprint, even though typecheck and API tests had passed.

**How to apply:** When cards or legacy story rewards change, update the count and fingerprint assertions deliberately. Keep the fingerprint covering all current rewards; excluding reward namespaces weakens save protection.

Freeze an isolated release candidate before final verification when other task agents can merge into the active workspace.

**Why:** A task merge during a successful release build made its output insufficient evidence for one coherent source tree. A narrowed candidate also avoided unintentionally releasing unrelated completed work.

**How to apply:** Build the candidate from current remote main plus the approved changes, and run the final gates there. When reusing installed dependencies, preserve candidate-local workspace-package links rather than linking entire package dependency directories back to the changing workspace. Finish dependency setup before starting checks, then require the uploaded and fetched full Git trees to match the tested candidate.

Keep release candidates and approval metadata in ignored workspace storage when preparation may span task reconciliation or later turns; do not assume `/tmp` survives.

**Why:** A candidate and its verification metadata disappeared from `/tmp` between preparation and a subsequent hotfix, while the workspace and Git references persisted.

**How to apply:** Verify any remembered candidate path exists before reusing it. Store durable preparation evidence under `.local/releases/` without adding its nested checkout, dependencies, or build outputs to the release. Also require `git rev-parse --show-toplevel` to equal the candidate directory before staging: a missing nested Git link can make `git -C` silently discover the outer workspace instead.

Nested checkout sources and worktree metadata can survive reconstruction while the checkout's `.git` link does not. Use Git's own `worktree repair` and verify the repaired repository root before reusing such a candidate.

**Why:** An ignored release candidate retained its frozen files and staged tree, but a later turn found its `.git` link missing. Commands in that directory initially referred to the parent workspace, which could have mixed unrelated changes into a release.

**How to apply:** Validate the candidate's Git root, parent commit, and staged tree at every release handoff; directory existence alone is insufficient. Repair the Git link rather than rewriting or discarding the candidate source.

Allow GitHub pull-request state to settle after a direct fast-forward update of the base branch.

**Why:** An immediate read reported the request as open and unmerged even though the verified head was already on the base branch. A subsequent read showed it automatically merged and closed.

**How to apply:** Verify the base branch's commit and tree first. Recheck pull-request state after the deployment starts before manually closing it or reporting that the changes remain unmerged.
