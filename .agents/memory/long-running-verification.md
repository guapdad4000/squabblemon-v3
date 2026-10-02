---
name: Long-running verification
description: Keep long offline simulations alive through the supported background-task mechanism.
---

Use the shell tool's explicit background-task option for verification commands that outlast a foreground call. Do not rely on shell `&`, `nohup`, or `setsid` to survive tool cleanup.

**Why:** Detached balance experiments were terminated without producing their result files even after using `setsid`. The explicit background-task option preserved the processes and their logs.

**How to apply:** Keep the returned task handle, collect the exit status and output, and wait for completed evidence before drawing conclusions. If a harness supports resumable checkpoints, never resume across changed mechanics or comparison axes.

Native test startup can appear idle while enumerating the cold, lazily mounted Nix store after a workspace restart.

**Why:** Directory enumeration blocked before PostgreSQL initialization even though the installed toolchain already supplied the required binaries. This was environment startup work, not a database connection failure.

**How to apply:** Prefer installed toolchain discovery before a full store search. Keep tests on their owned disposable database; do not switch to an inherited database to work around slow provisioning.

The owned campaign test runner requires the package-manager script environment. Invoking it with `pnpm exec node` does not supply `npm_execpath`, even though the command is launched by pnpm.

**Why:** A direct exec of the runner failed its guard before creating the disposable test database; `pnpm run` supplied the required environment and completed the targeted suite.

**How to apply:** Use a package script when invoking guarded database tests, and scope long suites to relevant groups rather than relying on a foreground run that may time out before buffered output is printed.

Background shell logs can retain carriage returns before newlines. Normalize line endings before checking whole-line completion markers.

**Why:** A successful batch with exit status zero appeared to fail a shell gate because its visible completion marker ended in a carriage return, so an end-anchored pattern did not match.

**How to apply:** Strip trailing carriage returns before exact line comparisons, and confirm completion with the background task's exit status and validated result files rather than one unnormalized log pattern.