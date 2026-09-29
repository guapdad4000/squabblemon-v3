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