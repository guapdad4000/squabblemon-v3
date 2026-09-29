---
name: Social load evidence
description: What isolated Homies contention measurements do and do not establish.
---

Treat local Homies benchmarks as comparisons of contention, not hosted player-capacity guarantees. Keep connection-pool delay in request latency, and distinguish observed PostgreSQL waiters from exact lock-acquisition duration.

**Why:** A global lock can fill a connection pool during a reconnect burst, delaying even operations that do not need that lock. Loopback SQL round trips also substantially understate the cost of long transactions on a hosted database.

**How to apply:** Preserve an identical workload when comparing implementations. Use populated menus and unrelated match traffic together; separate normal refreshes from synchronized reconnects. Before promising hosted capacity, require evidence from an explicitly authorized, isolated hosted environment rather than extrapolating from local concurrency counts.

Use bounded runtime diagnostic logs to identify likely sources of contention, not to estimate latency percentiles, request/error rates, or supported player counts.

**Why:** Sampling followed by per-process log suppression censors observations, and serverless instance churn changes which samples survive. Client-observed advisory timings also include network and transaction acknowledgement overhead; they are not PostgreSQL's internal lock timestamps.

**How to apply:** Keep incident warning signals separate from SLO/capacity evidence. A later metrics or alerting integration must account for missing/suppressed samples rather than treating emitted completion records as a representative population.