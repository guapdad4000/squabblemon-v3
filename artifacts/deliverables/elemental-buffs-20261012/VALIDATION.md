# Validation — retained elemental patch v60

- Full root/balance-patch regression suite: **2,068 passed, zero failed, zero skipped**, across 92 files. See root-tests.log.
- TypeScript check: passed, scripts/elemental-buffs.tsconfig.json.
- **7,296 simulated matches**, zero simulation errors across screening, candidate revisions, rejected experiments and retained-patch verification.
- Final retained-holdout confirms Plant, Air, Mushroom Garden and unchanged Dark/control recipes after reverting every Dark experiment.
- git diff --check passed.
- Retained canonical source matches candidate-source byte for byte; checksums and retained-changes.diff included.
- Rules and card-balance versions advanced to 60, with the printed-budget snapshot updated for Airheaded Model's cost reduction. Shared engine governs player/CPU/network/replay behavior.

No printed Hands increases. No deployment, commit, push, card art or minigame edits. These are local bot simulations and automated regression results, not live PvP balance evidence. Intermediate test logs correspond to rejected candidates and are not the final validation result.
