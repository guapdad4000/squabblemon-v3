# Kumite fighter films — October 17, 2026

## Player changes

- Owned Kumite fighters have a **Kumite film** replay action in their Collection inspector. An earned fighter dossier on the Kumite roadmap offers the same replay.
- Newly earned fighters with a film get one automatic presentation followed by their saved reward receipt. The presentation waits for Safehouse, Collection, or the Kumite lobby and does not interrupt an active battle.
- Nine films cover eight card identities: Bushedo Brown, Franklin Duke, Chonk Lee, Dragonfly Jones, P. Tang, Undercova Brotha, Sho'Nuff, and Leroy. **The Glo** is a second Leroy film. Yasuke retains his milestone without a fabricated film.
- P. Tang's four-win roadmap step now uses the same reward definition as the server. Existing eligible progress is reconciled on a Kumite refresh or safe-screen film check.
- Tournament size remains eight players and three rounds. Ordinary win and tier-promotion presentations are unchanged.

## Ownership and presentation

The existing collection claim ledger records the card grant and whether it was newly owned. A separate, account-bound presentation receipt is atomically consumed before playback. Eight concurrent claim requests produce one presentation. Playback cannot award, revoke, or duplicate a card. Old grants and milestones for cards already owned do not generate a backlog of automatic films.

The receipt is acknowledged before playing, so a reload or lost response can suppress that automatic viewing. Collection replay remains available. If navigation changes while a request is in flight, the current mounted session holds the presentation for the next safe screen. Sign-out discards that pending presentation. Media failure or skip proceeds to the saved reward receipt.

Reduced motion shows the card receipt directly; replay remains explicit. Native video controls, an autoplay-blocked play button, focus restoration, 44px controls and `playsInline` are retained. Rotation does not swap a running edit. Manual replay fetches no movie or poster before the button is pressed. Automatic presentation fetches media only after the server claim.

No SQL migration is required: the new typed metadata uses the existing JSON reward column and unique per-account milestone constraint. Deploy the API and frontend from the same revision. An old API lacking the receipt routes leaves manual replay usable; the gate fails quietly and retries on its next poll.

## Runtime media

`artifacts/squabblemon/public/assets/kumite/films/v1/` contains 18 MP4 edits and 18 WebP posters, approximately 27 MB. These are the approved v1 short films, with their existing audio. Full-length editing masters, the 6.7 GB kit, and unfinished announcer replacement are excluded from the game release. A later audio revision should use a new versioned path.

## Verification

- Shared libraries and frontend/API TypeScript checks pass.
- Production Vite build and bundle budget check pass: public entry 212.6 KiB / 475 KiB; GameApp 894.7 KiB / 900 KiB; Home 969.2 KiB / 1200 KiB.
- 17 focused film/receipt unit checks pass.
- 16 Kumite and online database checks pass against an owned temporary in-memory PGlite server, including account separation, eight concurrent claims, P. Tang reconciliation, preserved fighter growth, and duplicate prevention.
- Film browser checks pass at desktop, tablet, phone, small phone and landscape phone sizes: play, replay, skip, rotation, focus, reduced motion, locked ownership and missing-media recovery.
- Unlock browser integration passes normal, reduced-motion, failed-video, active-battle, navigation-race, sign-out-race and failed-claim scenarios under React StrictMode.
- Actual Collection inspector and Kumite dossier pass owned/locked browser checks at 390, 768 and 1440px. Mobile player and dossier screenshots were visually inspected.

Browser tests use intercepted API fixtures; server authorization is checked separately through real routes in the temporary database tests. This is not an authenticated live-site playthrough.

## Repeat checks

From the workspace root, run the database suite through a pnpm script environment with `npm_execpath` set to the installed pnpm CLI: `node scripts/test-api-database.mjs kumite`. From the frontend, `pnpm run test:kumite-films` runs the focused assertions. With the local Vite server at `http://127.0.0.1:4207`, run `node e2e/verify-kumite-films.mjs`, `node e2e/verify-kumite-unlocks.mjs`, and `node e2e/verify-kumite-owned.mjs`. Override the origin using `KUMITE_FILMS_ORIGIN`.

The unlock and ownership fixtures are development-only HTML entry points; they are not part of the production application build.
