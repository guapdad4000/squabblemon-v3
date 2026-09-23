---
name: Long-running verification
description: Keep long offline simulations alive through the supported background-task mechanism.
---

Use the shell tool's explicit background-task option for verification commands that outlast a foreground call. Do not rely on shell `&`, `nohup`, or `setsid` to survive tool cleanup.

**Why:** Detached balance experiments were terminated without producing their result files even after using `setsid`. The explicit background-task option preserved the processes and their logs.

**How to apply:** Keep the returned task handle, collect the exit status and output, and wait for completed evidence before drawing conclusions. If a harness supports resumable checkpoints, never resume across changed mechanics or comparison axes.