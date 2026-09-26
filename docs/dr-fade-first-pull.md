# Dr. Fade first pull

A new account with no pack openings sees Dr. Fade's welcome walkthrough in Recruitment. The dedicated welcome ticket guarantees one Dr. Fade pull. It costs no Clout or regular pack tickets and does not change pity. The existing starter crew remains intact; if Dr. Fade is already owned, the pull converts to the standard duplicate Style Shards reward, disclosed before redeeming.

GET /api/player/packs/welcome returns eligibility based on persisted pack history. POST /api/player/packs/welcome locks the profile, checks eligibility, grants the reward, and writes a fixed per-account receipt in the same transaction. Repeated requests return the receipt without granting again. Normal openings remain unchanged. The frontend saves its request before sending and retains the awarded reveal across reloads.

VO recording file: `artifacts/deliverables/dr-fade-first-pull-vo-raw.txt`. Read each paragraph as a separate clip, in order: intro, ticket, jab, hook, finish, reveal, duplicate, done. Duplicate plays only when the card was already owned. Reduced-motion mode skips the punches and goes directly to the saved reveal. Text is implemented; new audio awaits recording and has not been claimed as delivered or wired.

Validation: `pnpm test:campaign:db welcome-pull`; `pnpm --filter @workspace/squabblemon exec tsx e2e/verify-welcome-pull.ts` (UI_ORIGIN points to the local dev server).
