# Patch 1.15 — Kumite Breakthrough Beta

Prepared release content for the Events board and Mailman. This is a draft announcement, not a live-mode release or a mail broadcast. The public gameplay gate remains closed. The weekly Kumite tournament and ordinary Fade Park PvP continue independently.

## Player package

- Event poster: `public/assets/events/kumite-breakthrough-patch-1-15.webp`, with the 800 px `-small.webp` delivery for compact views. Both preserve the full generated composition. Source/prompt/dimensions/bytes/hashes are in `kumite-breakthrough-banner-assets.json`; built-in image generation was used, with existing approved Kumite characters and poster style as references.
- Events: featured **Kumite Breakthrough** post, marked **Beta in preparation**, with the complete playbook loaded only when requested. Direct information link: `/game/events?event=kumite-breakthrough-beta`.
- Patch notes: exact same payload in `docs/releases/kumite-breakthrough-1.15.json` and `src/lib/kumiteBreakthroughRelease.json`, selected from the existing private Patch Desk.
- Mail: **1 free Street Pack Ticket + 50 Clout**. Street Pack Tickets open Street Packs; they are not an entry fee for this mode. The letter opens the corresponding Events note. Reading and claiming remain separate.
- Full rules: `kumite-breakthrough-player-guide.md`; the same staged explanation appears in the saved-deck lobby, battle menu and Events playbook.

## Rules in one breath

Both sides deploy simultaneously across three lanes for three minutes. Motion starts at 4, refills by 1 every 2 seconds and caps at 9. Fighters clash with their current Hands; reach the enemy base twice to win. The final 30 seconds stop draws while Motion continues. At the bell, compare breaches, then surviving effective Hands, then draw. The playbook explains decks, Squabble, returns, effects, freeze, defenses and simultaneous finishes.

## What this candidate includes

The full 301-card real-time adaptation catalog, owned ten-card deck selection, CPU practice renderer, pure room/command foundation, approved search/entry/battle/results art and animation, responsive input fixes, effect feedback, and the measured media delivery pass. The adapter inventory is not a substitute for the full per-card acceptance ledger. The current renderer is local practice, not a hosted multiplayer service.

## Required before a public beta

Keep `BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED` false until current full-catalog evidence is complete and reviewed. Online transport, durable storage, authoritative settlement, anti-farming and real two-account/reconnect checks still need implementation and verification. CPU practice never awards account rank, trophies or Kumite roadmap credit. Do not advertise earned Breakthrough trophies or roadmap progress before that settlement exists.

## Publication and tickets

Use the existing authenticated Patch Desk flow described in `docs/patch-publications.md`. Save and preview v1.15 on the intended environment after its matching build is ready. Reconfirm exact copy, current audience and **50 Clout / 1 Pack Ticket** before its publish action. This preparation performs no publish or delivery command.

The stable campaign is `patch_1-15_9f0e787f95cbd2f6`, derived by the existing server publisher from version 1.15. Retrying delivery resumes that same campaign; claiming twice cannot credit twice. Do not also send an operator broadcast or invent a second campaign for this gift. Current server late-delivery reconciliation handles eligible new profiles; deployment and private desk preview are not evidence that a particular account has received or claimed mail. Inspect the actual delivery state after publication.

No new schema, gift endpoint, client-side grant or permission bypass is introduced here. Existing mailbox and publication transactions own the reward. Confirm the intended deployment's existing publication migrations and delivery worker before publishing; do not modify an applied migration.

## Review and shared PR

Review locally at `/e2e/kumite-release.fixture.html` (Event / Patch / Letter). This fixture blocks real account API calls and uses an in-memory letter; its claim receipt proves presentation only. `/e2e/breakthrough-guide.fixture.html` isolates the playbook. Neither exists as a public mode entry.

The draft PR is accumulated on `codex/kumite-breakthrough-integration`. Other agents should inspect its current HEAD, add only their own tested commits to that branch (or provide cherry-pickable commits), and update the PR description/check evidence after their changes. Do not copy unrelated dirty work, source masters, animation export ZIPs or the entire `output/` folder. Re-run the required gate after any source change; the recorded build applies only to its frozen source fingerprint. Do not merge or publish while contributors are still adding work.
