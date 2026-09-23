---
name: Git release history
description: Preserving external release history when workspace checkpoints use different commit ancestry.
---

Treat the current GitHub branch as the release parent, rather than assuming the workspace checkpoint branch can fast-forward it.

**Why:** Workspace checkpoints and GitHub releases have contained the same application state under different commit histories. The workspace also retained temporary debugging files that were intentionally absent from the release.

**How to apply:** Fetch the remote, compare actual file content, and preserve remote history. If ancestry differs, create a release commit from the remote parent with only the verified changes; compare the resulting application content with the tested workspace and use a non-forced reference update.

Command-line Git authentication and the connected GitHub integration can have different credential health.

**Why:** Git transport rejected authentication while the authenticated integration could read and update the repository normally.

**How to apply:** Use the integration's credential-injecting API when it is healthy; do not extract its OAuth credentials into shell commands or assume it needs reconnecting because Git transport failed.

Serialize machine-readable Git comparisons as JSON before returning them through tools. Do not rely on tab separators surviving rendered shell output, and sanity-check an unexpectedly empty diff.

**Why:** Removed tab delimiters made a parsed tree comparison falsely report no differences, which hid unpublished dependencies.

**How to apply:** Parse Git's NUL-delimited output inside the shell process, then emit JSON. Compare the complete candidate application tree against the tested workspace, not just the selected changed files, before updating a remote branch.