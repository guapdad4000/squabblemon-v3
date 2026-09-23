---
name: Git release history
description: Preserving external release history when workspace checkpoints use different commit ancestry.
---

Treat the current GitHub branch as the release parent, rather than assuming the workspace checkpoint branch can fast-forward it.

**Why:** Workspace checkpoints and GitHub releases have contained the same application state under different commit histories. The workspace also retained temporary debugging files that were intentionally absent from the release.

**How to apply:** Fetch the remote, compare actual file content, and preserve remote history. If ancestry differs, create a release commit from the remote parent with only the verified changes; compare the resulting application content with the tested workspace and use a non-forced reference update.

Use Replit's connected GitHub API for this project's release operations; do not require CLI login as the deployment-access prerequisite.

**Why:** The owner explicitly confirmed this API-based workflow. Command-line Git authentication and the connected integration can also have different credential health.

**How to apply:** Use the integration's credential-injecting API to inspect and update the release branch and inspect deployment statuses. Distinguish GitHub-triggered Netlify deployment from separate permission to manage Netlify environment settings. Do not extract OAuth credentials into shell commands or assume the integration needs reconnecting because CLI authentication is absent.

Use file-backed JSON for complete Git tree comparisons. Do not rely on tab separators or large shell output surviving tool transport, and sanity-check an unexpectedly empty diff.

**Why:** Removed tab delimiters made a parsed tree comparison falsely report no differences, which hid unpublished dependencies. A large JSON tree listing also arrived as a truncated tail despite a raised shell output budget.

**How to apply:** Parse Git's NUL-delimited output inside the shell process, save full trees to temporary JSON files, and return only the comparison summary. Verify entry counts and compare the complete candidate application tree against the tested workspace, not just the selected changed files, before updating a remote branch.

If Git fetch succeeds but HTTPS push rejects the workspace credential, transfer the verified release through the connected GitHub API: upload missing binary blobs, create a tree on the current remote base, and require its SHA to equal the tested local tree before creating the remote-parent commit. Advance `main` with `force: false`; keep the original workspace branch intact and check out the newly fetched remote commit.

**Why:** Read access and write authentication can differ. The API route preserved the newer GitHub parent without extracting credentials, while a tree-SHA comparison proved the uploaded release was byte-for-byte the one that passed validation.

**How to apply:** Use this only after confirming the remote parent has not moved. A successful GitHub update does not prove the Git-triggered Netlify deployment succeeded; check that provider separately.