# Kumite opponent-search audition

This local audition explores a black-and-white fighting-game search screen for Kumite Breakthrough: the player's locked crew, an unknown challenger, elapsed search time, then the supplied opponent reveal. Player names and state remain live text; Squabblemon artwork, display fonts and fist identity carry the presentation.

`artifacts/squabblemon/e2e/kumite-matchmaking.fixture.html` is a development-only fixture. Its controls explicitly stage search, reconnect, found, connecting, error and cancelled states. Fixture identities and elapsed time are synthetic review inputs. No opponent is found automatically, no match is started, and no queue mutation or account reward is issued. This is presentation evidence, not live matchmaking or deployment proof.

`KumiteOpponentSearch` consumes a supplied player identity, discriminated search state, busy/reduced-motion flags and callbacks. It owns no queue admission, opponent selection, persistence, result or launch decision. No online counts, estimated waits or ping values are invented. Public Breakthrough launch gates remain separate and closed until their existing readiness requirements pass.

## Contract for real queue integration

- An authenticated server must admit a legal, owned crew and issue a queue identity, authoritative queued timestamp, state/version and explicit result. The client supplies intent and renders confirmed state. Scope cached queue/room data to the signed-in account; discard stale responses after account, queue or request changes.
- Search and cancellation need documented typed endpoints, validation, authorization, retry identity and recovery behavior. Reuse the original request ID after an uncertain acknowledgment. A timeout or disconnected browser does not prove the write failed; reconcile with the authoritative queue before creating another search.
- Resolve the cancel-versus-match race on the server. A cancellation acknowledgment must distinguish a confirmed cancellation from a match already assigned. If pairing won, preserve and resume that match; never show a successful cancellation or silently replace the opponent. Define whether backing out after assignment merely returns to the lobby or has another consequence before wiring that control.
- Derive elapsed time from the server timestamp, with a defined server-clock offset. A visible local tick may update the display but must never create a match or trigger a bot. Preserve queue identity during reconnect and require a fresh read before dependent actions. Define heartbeat expiry, hidden-tab behavior and recovery for refresh, offline and authentication loss.
- Reveal opponent name, crew and approved art only after authoritative assignment. Use public identity fields and existing avatar/banner resolvers; never expose private deck contents or user identifiers. Counts, connection quality, wait estimates and fallback opponents require real server data and explicit product rules before display.
- Keep weekly Kumite independent. Its existing tournament service assigns bracket opponents, locks registration decks and uses ready/check-in deadlines. Returning to its bracket does not forfeit; surrender remains an explicit confirmed action. Fade Park's ranked queue, six-second Park Bot fallback, RP settlement and cancel endpoint are not a Kumite queue contract.

Before public integration, cover competing search/cancel acknowledgments, pairing during cancellation, stale polls, uncertain writes, account changes and reconnection against the real transport. Verify the full browser-to-server journey and preserve the existing launch gate; an SSR test or staged reveal cannot establish that journey.

## Focused validation

`KumiteOpponentSearch.test.tsx` checks unknown versus assigned identity, truthful transition announcements, busy/retry action boundaries, cancellation/error recovery text and a single live state announcement through server rendering. Responsive layout, keyboard interaction, visibility changes and reduced-motion animation behavior require separate browser checks.


## Browser and asset evidence (2026-10-29)

- Local browser viewport checks: 320×568, 390×844, 768×1024, 844×390 and 1280×720. At all five sizes the matched sample names fit, document dimensions match the viewport, and the main action remains in bounds with a 48px height. Artwork intentionally crops at the stage edges.
- Exercised staged search, found, reconnect, error, cancel, retry and return to the synthetic deck picker. Reduced-motion staging disables the eight scan/signal animations; the error has one live announcement. This is browser viewport evidence, not physical-device or live-queue proof.
- Frontend TypeScript check passed with the incremental cache redirected to `/tmp`. Four focused SSR tests passed with zero failures, skips or todos; the final machine-readable result is in `output/kumite-matchmaking-20261029/focused-check.json`.
- One new original illustration was generated with the built-in image generator: `public/assets/kumite/matchmaking/unknown-challenger-v1.webp`, 750×900 RGBA, 215,626 bytes (210.6 KiB). The 1145×1374 original PNG remains under `output/kumite-matchmaking-20261029/`. Only resizing/encoding were used for the delivery derivative. Existing fighter art remains unchanged.
- No public route, live queue, rewards, engine rules, main push or deployment was added by this audition.


## Original CSS reveal (superseded by supplied animations)

Search stays monochrome. A supplied opponent triggers a single 720ms diagonal paint slash, staggered opacity reveals of the original full-color fighter art, and a gold/oxblood arena palette. `matched` and `connecting` share the same color state; moving between them does not replay the slash. Search, cancellation and errors remove the reveal and restore monochrome. Saved and OS reduced-motion preferences apply final colors immediately with no slash, animation or transition. The color transition reuses existing fighter art and never delays transport/navigation; grayscale fighter layers stop drawing after the crossfade. Added environment and clash art is recorded below.


## Original static environment audition and animation masters

The original static audition used gold/ochre and oxblood/red dojo courtyard plates, with a transparent ink-lightning rift behind the fighters at assignment. Searching shows the environments in monochrome; assignment reveals their color with the existing paint slash. Decorative layers remain absolute, ignore pointer input, and preserve the established responsive layout. The rift keeps its DOM through `matched` to `connecting`; saved and OS reduced motion remove its entry animation. A low-priority preload prepares the generic rift while searching without revealing opponent information.

Three single-frame runtime WebPs are 960 x 1440 and total **698,956 bytes / 682.6 KiB**: `side-you-gold-v1.webp` (244,766 B), `side-opps-red-v1.webp` (253,176 B), and `clash-rift-v1.webp` (201,014 B, RGBA). Existing fighter and unknown-challenger art is unchanged. PNG masters, exact prompts, hashes, alpha measurements and animation notes are in `output/kumite-matchmaking-art-20261029/`. All five new masters were generated with the built-in image generator; WebP delivery derivatives were resized/encoded only.

The separate 1672 x 940 closed/open transition pair has matching canvas registration and a real transparent open center. It is animation source material, not a new movie or a live game transition. Those PNGs are excluded from the game load. The verified ZIP is `kumite-matchmaking-animation-kit.zip`; `ART-KIT.html` provides a local contact sheet, and `asset-manifest.json` records measured file data. This remains a local visual audition with no new transport, launch, reward or production integration.


## Supplied animated matchmaking (2026-10-30)

The current audition integrates all six user-supplied GIFs. Search plays the monochrome brushstroke background plus the transparent idle streak. Authoritative assignment (staged by the fixture) reveals the original full-color fighter art over the colored brushstroke loop and one black/white cross-slash burst. After the supplied2920ms burst completes, the two animated courtyards appear behind the fighters. The idle streak follows their diagonal split. The colored brush video pauses and unloads at that point, so it does not decode underneath the courtyards. Matched to connecting keeps the same encounter and does not replay the burst. No media completion delays owner navigation or creates a match.

All source dimensions, frames and timestamps remain. Four opaque loops use H264 MP4 CRF28/yuv420p/faststart; the transparent idle streak uses lossless animated WebP, and the burst uses q65 animated WebP with original alpha. Burst WebP loop1 and its load-driven finite CSS envelope prevent replay; its67frames retain the280ms clear tail. All other clips retain73frames at25fps. All durations are2920ms. Lossy encoding softens fine GIF grain; output is not pixel-identical to GIF masters. Six lossless source-frame posters cover reduced motion, inactive media and fallback.

| Role | Selected motion bytes | Still bytes |
| --- | ---: | ---: |
| Monochrome brush background | 1,087,233 | 121,556 |
| Colored brush background | 1,440,469 | 99,068 |
| Gold courtyard | 404,323 | 187,558 |
| Crimson courtyard | 272,140 | 189,554 |
| Match-found cross-slash | 1,515,784 | 95,100 |
| Idle white streak | 408,440 | 5,702 |

Selected delivery plus all six posters totals **5,826,927 bytes**, versus **30,131,464 bytes** of supplied GIFs (**80.66% smaller**). This is total optional media, not first-render transfer: source-less video elements use preload none and acquire motion only when visible/active with motion allowed. Courtyard motion is not admitted before the reveal completes. Downloads originals remain unchanged. `output/kumite-matchmaking-animation-20261030/asset-manifest.json` records source hashes, dimensions, counts, delivery and poster sizes. Candidate and exact timing/still measurements are retained alongside it; encoding candidates remain outside public assets.

`KumiteMatchMedia` shares the existing `observePlayback` implementation. Hidden/inactive videos pause and unload; alpha images swap to true stills. Local, saved and OS reduced motion all stop decoding, rather than merely pausing CSS. A loaded burst retires permanently if interrupted; failed media settles safely without blocking controls. A generation token prevents a late rejection from an intentionally interrupted play request from poisoning a resumed video. No new frame loop or elapsed-driven effect was added. The two matchmaking suites are included in the existing required Kumite release check.

Final local checks: frontend TypeScript;37 focused tests across matchmaking state, media lifecycle and release-gate regression; five browser viewports320x568,390x844,768x1024,844x390,1280x720 with no document overflow, fitting sample names and reachable48px main action; phone/search and matched court framing; connecting continuity; local reduced-motion mode stops all video sources and uses the streak still. This remains local fixture evidence, not a physical-device, production-transport or deployed-launch result. The public launch gate remains unchanged.


## Entry timing correction and parked streak (2026-10-30)

Supersedes the earlier found-burst/idle sequence: opponent assignment now shows the gold and crimson courtyards immediately, with no slash burst. The supplied colored brush background plus finite cross-slash runs only in `connecting` (the fixture's **Enter arena** action), then settles back to the courtyards if the screen is still mounted. This remains decorative and never waits before or controls navigation. Elapsed updates and repeated renders of the same connecting encounter cannot replay the finite media.

The idle white streak is removed from every Kumite state; neither its animation nor its still is requested by this screen. Both derivatives and the user's original remain preserved. See `docs/design/pvp-mat-split-streak.md` for the regular PvP player-mat split idea and the proposed black variant. No black variant has been generated and regular PvP remains unchanged.


Correction verification: frontend TypeScript passed. Focused state/composition/media lifecycle tests cover immediate courts at assignment, no idle streak, entry-only burst, completion and phase-bounce no-replay. A separate local browser fixture confirmed matched media are only the court loops, entering admits brush+burst, and completed entry restores courts without restarting after a matched/connecting bounce. Retained optimized assets total5,826,927B including the parked streak; current Kumite references total5,412,785B including all relevant still posters. No public launch or regular PvP changes.


## Direct battle entry and result courtyards (2026-10-30)

This supersedes the earlier entry-completion reset: while `connecting`, the screen stays on the colored energy brush background after its finite overlay finishes. It never returns to the location/courtyard stage during entry. `onEntryComplete` signals cosmetic readiness to the owner; it does not change transport, rewards, or admission. Ordinary renders do not repeat readiness. A later explicit owner entry may reuse consumed presentation readiness without replaying the burst.

The development matchmaking fixture now preloads a reviewed synthetic CPU battle on Enter arena, then mounts the existing `BreakthroughArena` only after presentation readiness and module readiness, while visible. The arena's existing650ms flame transition is the single battle-entry flame. No arena clock runs during the import/energy stage. Cancellation, new search and unmount invalidate late imports; hidden completion waits for visibility; import failure shows a retry/back state. The battle module and canonical roster are deferred until entry intent. This is local CPU preview wiring, not online matchmaking or public release. The launch gate remains false.

The actual shared `ResultStage` now uses the same gold-left/crimson-right courtyard assets behind its approved center scroll, W/L animation, receipt and controls. A player win animates/highlights gold only; an opponent win animates/highlights crimson only; draws keep both static. Local, saved and OS reduced motion keep the result state and highlight while disabling courtyard playback. The losing side stays dimmed and still. No new image or video asset was created. The retained idle streak remains absent.

The standalone DEV-only result preview is `e2e/kumite-results.fixture.html?outcome=win` (also loss/draw, optional motion=reduced). Its displayed receipt is synthetic and grants nothing. The real result component remains wired to actual engine results in the battle.

Verified locally: energy+burst with no courts during connecting; one actual arena and one existing flame after handoff; no browser errors on that flow; win-only gold playback, loss-only crimson playback, static draw and reduced-motion results. Results geometry checked320x568,390x844,768x1024,844x390,1280x720: no document overflow, all three actions in bounds and at least44px high. Phone and desktop result framing were visually inspected. TypeScript and50 focused tests passed. Focused tests cover phase readiness, finite media, stale/cancelled/hidden imports, result winner gating and unchanged production launch boundaries. No physical-device, real-queue or deployment claim is made.


## Bug audit and corrections (2026-10-30)

The follow-up audit repaired duplicate arena-entry/readiness races, initial/queued hidden-tab clock and input handling, Escape on the practice menu select, stale drag capture on result controls, result event isolation/focus restoration, saved reduced-motion receipt reveals, media kind/callback/stale-event ownership, interrupted/stalled finite bursts, and standalone preview return navigation. The audition tools now scroll within short viewports. Approved art, card rules, rewards, queue authority and the closed public launch gate are unchanged.

The full registered suite passed 1,048 tests; the final frozen focused suite passed 102 tests, both with zero failures/cancelled/skips/todos. Frontend TypeScript passed. Browser checks covered cancellation/retry, normal/reduced entry, menu pause/Escape, actual loss/rematch, preview return navigation, winner-only court motion, keyboard focus wrap and five result viewport sizes. Detailed findings, exact evidence boundaries and source hashes are in `output/kumite-matchmaking-audit-20261030/README.md`, `critical-suite.json`, and `final-scoped.json`. This is local CPU/fixture proof; authoritative online matchmaking, real-device parity and deployment remain outside the verified scope.


## Media delivery optimization (2026-10-30)

The Breakthrough media pass now selects revision-safe compact art for all 301 base-catalog battle portraits, removes speculative warming of all eleven future effect/health atlases, retires the 650 ms fire node, pauses hidden presentation independently of gameplay, and serves 17 exact source-frame stills in reduced mode. Normal animations, source art and timings remain unchanged. The W now uses the same visibility/reduced-motion decoder gate as the court media.

The fixed 10 s phone workload's normalized required-source payload fell 11,908,691→5,368,355 bytes (54.92%); its reduced variant required 800,433 bytes. This is a unique source-file payload model from observed requests plus initial CSS plates, not cold-cache network transfer. The static 17 deliveries total 767,152 bytes and are checked for exact pixels/alpha/dimensions/current-source hashes under a 1 MiB guard. All 301 base portrait payloads aggregate 103,190,366→13,445,364 bytes; galleries retain originals. The full registered suite passed 1,066 tests with 334 stable input hashes; frontend and standalone fixture TypeScript passed. See `output/kumite-media-optimization-20261030/README.md` for full evidence, limitations and rejected encodes. No public launch or production transport claim.
