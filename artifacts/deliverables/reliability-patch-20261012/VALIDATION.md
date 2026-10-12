# Validation

- Final root regression suite: 2,052 passed, zero failures.
- Focused boundary tests: 19 passed (included in root total).
- Focused TypeScript check passed; types.log is empty.
- 5,376 simulation matches across baseline, isolated variants, combined candidates, and corrected arrival-hook verification; 0 simulation errors.
- Final retained patch: 768 matches across two paired draw sets, all four tiers, both seats, two policies.
- Rules and card-balance versions: 58. Printed card budgets unchanged, including Nerd at 5 Hands.
- Source hashes match the tested local source snapshot.
- No commit, push, or deployment performed.

See METHOD.md for scope and limits; root-tests.log for full test output. The pre-arrival-fix folder preserves superseded candidate results, not final patch evidence.
