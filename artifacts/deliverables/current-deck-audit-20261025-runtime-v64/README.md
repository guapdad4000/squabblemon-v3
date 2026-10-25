# Preserved runtime candidate — telemetry issue diagnosed

This source-bound candidate completed **20,368 successful fresh simulations**, with zero execution failures, plus 276 full-event/compact-preview verification comparisons. Source: `b16e3a70425d6fd308d216f198ea279b478d44e48a0f45bfcac8e845570442c3`.

Every gameplay outcome and nonclassification telemetry value matched the exact original v64 schedules. All 17,296 matrix rows and all 256 confirmation rows matched completely. Two of 2,816 stress rows differed only in Ptang's current event classification: one no-observed-effect event became a direct-effect event in each row.

The current classifier inherited a JSON-string comparison: equal Waterboy mechanical values with different object insertion order appeared different. The exact affected cases are stress indices 85 (`probe-delivery`) and 117 (`probe-transplant`), Ptang ability sequence 75. This is an instrumentation false positive; it is not an additional ability effect or a changed winner, board, choice or card power.

This candidate is preserved as diagnosis evidence, **not the accepted current deck report**. The diagnostics-only correction compares current mechanical JSON values independently of object key order, preserving array ordering and real value changes. The explicitly legacy raw-counter heuristic remains available and labelled. A completely new run is in [runtime-v64-telemetry](../current-deck-audit-20261025-runtime-v64-telemetry/README.md); its outputs are independently simulated, not copied from this candidate.

See [exact raw-case comparison](runtime-equivalence-results.json). Old accepted v64 files and this candidate's plans/raw outcomes remain unchanged.
