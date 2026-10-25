# Beta hardening evidence — October 25, 2026

The [hardening report](../../../docs/audits/beta-hardening-2026-10-25.md) explains changes, exact checks, resolved failed attempts and remaining release gates. [verification.json](verification.json) is the concise machine-readable scope; [release-gates/](release-gates/) retains the frozen-source production build and complete local onboarding journeys.

- [Current named deck report](../current-deck-audit-20261025-v64/README.md): 20,368 scheduled matches, 46 named decks, all 301 playable cards observed.
- [Campaign and database diagnosis](campaign-diagnostics/DIAGNOSIS.md): failed attempts retained, final embedded365/365, native feedback12/12 and social35/35.
- [Online recovery](online-rules-recovery/README.md) and [native retirement](online-retirement/README.md): separate browser and transaction evidence.
- [CPU policy](cpu-policy/README.md): exact paid actions, hidden information, delayed effects and local timing probe.

`tested-candidate.patch` is the tracked binary diff against the recorded base. `new-source.tar.gz` holds the new source files identified by the release gate. Apply/overlay on the recorded base for the gate-bound source; test-only browser runners and additional docs remain in the working tree. `evidence-sha256.json` hashes every retained file except itself.

These are local source, fixture, simulated battle and owned database results. No deployment, physical-device, authenticated staging, real two-client network, human balance or live-payment proof is claimed. Nothing was committed or pushed.
