---
name: GitHub proxy release staging
description: Workspace path and index-output quirks when staging local changes for a GitHub connector push.
---

When preparing a GitHub connector push through CodeExecution, run shell commands with an explicit workspace directory and parse `git ls-files -s` with flexible whitespace after the stage number. The callback's shell working directory may not be the project, and its returned output may collapse the tab separating the stage number from the path.

**Why:** A release attempt prepared zero changed files and a subsequent index parse found zero tracked entries, despite a nonempty working tree. Explicit paths and tolerant parsing resolved both before the actual push.

**How to apply:** Guard against empty or unexpected file lists before creating GitHub trees. Compare touched paths to remote blobs and use a non-forced ref update.

Keep impure transfer functions within the CodeExecution block that invokes them; persist data and transfer receipts rather than those function wrappers between turns.

**Why:** Invoking a stored impure function in a later notebook call failed with `executeJs is not defined`, while the same logic in an inline impure invocation succeeded.

**How to apply:** Use inline impure calls for network/SDK operations, with file-backed progress for resumable transfers. Do not interpret this wrapper error as a GitHub authentication failure.