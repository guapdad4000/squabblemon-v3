---
name: GitHub proxy release staging
description: Workspace path and index-output quirks when staging local changes for a GitHub connector push.
---

When preparing a GitHub connector push through CodeExecution, run shell commands with an explicit workspace directory and parse `git ls-files -s` with flexible whitespace after the stage number. The callback's shell working directory may not be the project, and its returned output may collapse the tab separating the stage number from the path.

**Why:** A release attempt prepared zero changed files and a subsequent index parse found zero tracked entries, despite a nonempty working tree. Explicit paths and tolerant parsing resolved both before the actual push.

**How to apply:** Guard against empty or unexpected file lists before creating GitHub trees. Compare touched paths to remote blobs and use a non-forced ref update.