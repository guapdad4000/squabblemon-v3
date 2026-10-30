# Kumite Breakthrough integration verification

Current release policy: **public entry is locked until all cards work**. This report describes the earlier integration build. Its browser journey and source fingerprint predate the full-catalog implementation; see `kumite-breakthrough-all-cards-launch-gate.md` for the current 301-card state, launch policy and fresh gate evidence. The remaining-card counts below are historical.

Verified locally on October 29, 2026, in `codex/kumite-breakthrough-integration` from fetched main `77f44c8b597a908202d5f65b8ecc293e4b47f5d6`. The original dirty audition checkout and its running port 4278 were preserved. No commit, push or deployment occurred.

Current full-catalog implementation and verification: `kumite-breakthrough-full-catalog-verification.md`.

## Implemented first build

- Primary Kumite entry and lazy `/game/kumite/breakthrough` route; `/practice` is an alias to the same practice entry. Starting a match is local page state.
- Existing account deck picker, account-scoped selection persistence, owned starter recipes and narrowly allowlisted editor return. Missing hero and unsupported cards fail validation without silently modifying the deck. Loaners are explicit and separate.
- Final canonical catalog registry: 45 supported definitions (42 characters, 3 support actions), complete compatibility inventory for 301. Five complete starter decks: THE BLOCK IS HOT, SLIDE THRU, RECEIPTS, CRASHOUT SEASON, GOOD VIBES ONLY.
- Bus Pass, Soul Food and Cognac play immediately as authored automatic actions. Empty invalid target lanes are disabled; server-domain commands can lock the authored target and reject stale intent without charge. Actions never march, collide or breach. Baby Momma and Closet Nerd include their reactive mechanics and private reveal behavior.
- Approved battle presentation, stable hand slots, synchronous same-lane drops and real pointer drag retained. Developer controls and fixed 590-point receipt removed from the player route. Result focus/keyboard handling and saved/OS reduced motion are supported.
- Normalized canonical base stats; upgrades do not apply and the hero is the visual captain. CPU practice grants no account rank, trophies or roadmap credit.
- Pure authoritative room foundation: per-seat command sequencing, retry fingerprints, trusted clock, private projections, fenced atomic-store contract, durable journal recovery and unique terminal outbox identity. This is not a live multiplayer service.
- A pre-existing malformed Dojo-reminder response crash discovered during full-shell testing was guarded; invalid HTML/partial data no longer takes down the shell.

## Local checks

| Evidence | Result |
| --- | --- |
| Required release gate | 460 tests passed; no failures, skips or todos |
| Breakthrough registered suite | 180 tests, including Dojo response guard |
| Production frontend build |Passed; source fingerprint bound to the working candidate |
| Shared library build |Passed |
| Frontend and API TypeScript |Passed |
| Entry JavaScript budget | 211.6 KiB / 475 KiB |
| GameApp JavaScript budget | 653.0 KiB / 900 KiB |
| Home JavaScript budget | 713.9 KiB / 1,200 KiB |
| CSS invalidation/panel checks |Passed; 54 emitted stylesheets |
| Approved media preservation | 54 files, 16,348,370 bytes; all byte-identical to approved audition source |
| Scoped diff check |Passed |

The production build excludes the disposable auth flag. The browser shell used the existing DEV-only disposable account harness on localhost 4285, which was stopped after testing. Port 4284 retains an explicitly synthetic-account fixture for review. No auth protections were changed.

Raw evidence lives in `output/kumite-breakthrough-integration-20261029/`: `release-build.json`, build/typecheck logs, `media.json`, `responsive.json`, `browser-proof.json`, and screenshots. The release record contains the exact base commit, tracked diff hash, untracked source hashes and critical input hashes; a changed source requires fresh verification.

## Browser scope

The actual GameApp route shell passed disposable sign-in → Kumite entry → Breakthrough → choose SLIDE THRU → existing deck editor → return with the selected deck preserved → start CPU practice. An incompatible WHO YOU KNOW deck remained visible with exact reasons and a disabled Play action.

The production renderer was also exercised with an explicitly synthetic saved account deck at 390×844: native Snow Bunny drag, rapid same-lane plays, invalid support target cues, immediate Cognac resolution from 2 to 5 Hands, CPU loss/result, rematch, result focus trapping and return to deck selection. Text selection remained empty. Saved reduced motion was checked while the OS setting was false.

Geometry and primary controls were inspected at 320×568, 390×844, 844×390, 768×1024 and 1280×720. The lobby uses deliberate page scrolling on short screens and a horizontal deck rail; the battle retains the viewport and the menu has internal scrolling. These are browser checks, not physical-device, accessibility-certification, frame-time or network-latency evidence.

## Remaining implementation gates

1. Review and implement 236 remaining character adapters, 10 support actions and 10 blockbusters. All 301 legal account definitions remain the full-release target. Preserve explicit compatibility rejection until each effect is proved.
2. Implement a durable room store, atomic revision/fence checks, owner leases, authenticated transport, tick scheduling, reconnect/forfeit policy and real two-account input tests. Current room tests use a contract-conforming test store and cannot establish database or distributed-host behavior.
3. Define and implement separate Breakthrough reward tables, trophy thresholds, anti-farming rules, server terminal receipts, leaderboard and roadmap credit. No local result may grant progression.
4. Complete copy/summon/form policy, full catalog/deck interaction coverage, real phone performance and touch checks, authenticated account/deck persistence tests, and staged deployment readiness proof.
5. Extend the three requested normal-PvP ranks as its own explicit economy integration. Preserve existing weekly bracket/story/dojo/mastery semantics.

The full target and architecture remain in `kumite-breakthrough-production-integration-plan.md`. This first build is a limited local CPU integration, not a completed public competitive release.
