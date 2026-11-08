# Kumite hallway and Breakthrough registration

The hub uses the user's animated Breakthrough poster, four wall notices, a hanging clock, record pennants and a floor sign. The clock retains the artwork's exact 2:1 ratio at every size; its live label/countdown occupy the black display opening. All dynamic values remain DOM text.

## Poster playback

The supplied short GIF loops for 2.92 seconds with a static red halo. A normal click disables the wall, removes the halo, and plays the portion starting at 2.88 seconds of the longer GIF before routing (2.92 seconds in the delivery file, including the final transparent frame). Modified link clicks retain normal browser behavior. The peel is presentation only: it never starts matchmaking or changes results. The existing search/found/arena/result flow keeps its timing.

Transparent animated WebP derivatives preserve the source's 25 fps and dimensions, with lossy quality 55 encoding. The idle file is about 2.4 MiB and the exit about 1 MiB, replacing roughly 21 MiB of source GIFs. The exit is fetched only on activation; hashed production assets can be cached. The lobby uses a small static first frame. Pause, OS/account reduced motion, document visibility and intersection state stop idle animation by replacing it with the still. Reduced motion bypasses the peel. Errors navigate immediately, and a six-second load timeout prevents a broken or slow animation from trapping entry. Timers and observers are cleaned up on unmount. No frame loop or per-frame React updates.

Final artwork dimensions, durations, bytes and provenance are in `artifacts/squabblemon/src/components/kumite/assets/hallway/manifest.json`. The supplied anime alley and props keep their alpha. Earlier generated poster/wipe assets are historical alternatives and no longer used in the main flow.

## Flyer wipe

At 2.2 seconds into the peel, five staggered paper sheets rush across the viewport. The route changes only after 680 ms of coverage; an opaque paper backing prevents a destination flash between sheets. The overlay survives the hub unmount and waits for `kumite:entry-ready`, then clears in 700 ms. A bounded fallback releases it if readiness is missing. Existing static flyer/paper assets are reused; the wipe adds no animated download or per-frame React updates.

Escape, a hidden tab or an OS motion change skips the ceremony. Account/OS reduced motion bypasses it. Unmount before handoff cancels navigation, and completion restores input and focuses the destination heading. `e2e/verify-flyer-wipe.mjs` checks these lifecycle paths plus coverage and focus at desktop, phone and landscape sizes.

## Registration hierarchy

A small poster stamp anchors the header. Identity and trophy record sit above the deck slips; accessible previous/next controls scroll the rail without changing the selected deck. These controls are opt-in on the shared picker so other venues keep their existing behavior. The find-opponent action follows the picker, with rules collapsed below. The worldwide notice follows registration, with top three, a scrollable top 20, and the player's own row even when outside the leaders.

## Standings contract

Authenticated `GET /api/breakthrough/standings` is additive on both Express and Netlify. It uses the existing protocol, origin/authentication rules and request limiter; responses are private/no-store. The shared response-only contract lives in `lib/api-zod/src/breakthroughStandings.ts`, outside gameplay behavior modules. The endpoint neither wakes match workers nor writes records.

A single PostgreSQL read ranks the current season's existing `breakthrough_records` by trophies. Equal trophies share a dense rank; wins, name and stable account ID order ties deterministically. Only completed-onboarding profiles or the ten known Kumite rival identities with at least one recorded rated result participate. Rivals use actual records, with an AI label; nothing seeds fictitious scores. The response contains at most 20 leaders plus the caller's row, no account IDs. Existing settlement and reward limits are unchanged.

The frontend requests standings only when the notice approaches view, caches by account for 60 seconds, and has no polling or focus refetch. Returning from a match invalidates that account's cached standings. Expansion uses the same bounded response. Empty and failed reads preserve matchmaking and expose retry.

## Verification

`e2e/verify-kumite-hallway.mjs` uses actual components with synthetic API responses at 320×568, 390×844, 844×390, 768×1024 and 1440×900. It covers art, overflow, keyboard poster activation, pause/reduced motion, exit timing, deck arrows/selection, ranking expansion, one search, cancel, persistent selection and tournament entry. `e2e/verify-breakthrough-live-polish.mjs` covers the existing search/found flow and double-break wins from both seats.

`node scripts/test-breakthrough-database.mjs --netlify` uses a fresh local PostgreSQL database, tests standings ties/eligibility/bounds/account isolation and both transport routes, then exercises the existing authoritative lifecycle suites. This is isolated database/browser evidence, not an authenticated production journey or physical-device check. Design changes remain local until explicitly published.
