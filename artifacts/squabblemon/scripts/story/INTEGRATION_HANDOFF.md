# Chapter One — integration handoff

Historical writing handoff. The current local campaign status is in [README.md](README.md); Chapters 1–8 are now loaded in the game.

2026-09-08. Writing is complete for editorial review; this checklist does not claim the revised dialogue or artwork is playable.

## What to integrate

Preserve blockPartyChapter's eight node IDs, map positions, prerequisites, optional flag, encounters, decks, modifiers, phases, star objectives, teaching metadata, and rewards. Replace only the old narrative arrays with the approved scene text. For battle nodes, map “Before the match” to preDialogue and “After victory” to postDialogue. Map the ceremony to block-crowned.scenes.

The normal screenplay has 106 lines, including 11 in the optional alley. Required path: 95 lines. Seven additional defeat lines and three boss-phase lines are optional future presentation work; do not append them to victory arrays. Preserve speaker spelling and separate stage directions from spoken text.

## Cast

Existing speaking roster entries: ganger-blue, ganger-red, snitch, cracked-head, alley-runner. Add cornball (compound/support), wifey (old-heads/support), and baby-momma (old-heads/rival) before integrating their lines. Their matching WebP portraits exist. Alley Runner currently shares Blue's portrait; dedicated art is still a request. The unused block-crowned-host entry is not a ninth speaker. OG Uncle has a revised bible and an existing portrait but no Chapter One speaking role.

Roster hints are not proof of reward grants. Chapter One currently grants no character-unlock reward. Do not add an unlock merely because a character appears.

## Dialogue state and playback

Story.tsx currently derives node-id:pre:index, node-id:post:index, and node-id:main:index tokens. Scene tokens follow that order; StoryDialogueLine has no token field. Review saved progress when replacing the old one-line arrays: old tokens may mark different new lines as read. Decide a content-version/migration strategy before release; do not silently change the meaning of a persisted token or erase player battle/reward progress.

Keep pre-battle, victory, and ceremony displays correctly gated. A defeated player must not receive victory concessions, rewards, or the next story beat. Already completed nodes may use the existing replay/skip policy. Main canon never depends on perfect stars. Dialogue advances on player input; short cinematics cannot time out multi-line exchanges.

## Stage and audio

The comedy revision adds proposed prop and sound work: a dead karaoke mic, folding-chair throne, extension-cable lighting gag, courtroom-style kitchen timer, air-fryer media desk, gift-wrap entrance carpet, off-screen fish-fry smoke, organ interruption/battery warning, plastic Crown on a neck pillow, and Baby Momma disconnecting the ring light. These are authored production directions, not delivered assets or mandatory gameplay features. Keep the spectacle in staging and preserve reading time. Any organ/battery/applause sounds require asset selection and timing; fallback staging must still make sense without them.

Scene briefs propose layer stacks and short establishing moves. They do not prove PNGs exist. The opening, Snitch, and Cracked Head IDs already have configurations, but the draft changes their layer/cue requirements. Five other scene IDs are proposed. The old red-side rooftop config does not match Scene 4's red-fence setting; create the proposed matching config instead of blindly reusing it.

Populate or deliberately bypass the empty story venue registry using the game's actual venue assets. Keep existing MP4/poster fallback behavior during rollout. Match speaker portraits, reaction shots, and proposed focus layers. Keep dialogue rendered by UI instead of baking it into art. Lower ambience at the memorial, return, and Baby Momma's entrance. New sound or phase hooks require implementation, not just a screenplay label.

## Economy and future chapter

Six required battles grant 775 street-xp in total. Optional alley grants side-alley-tagged-cardback. Each of seven battles can award one ticket on its first perfect clear. The current ceremony grants nerd ×1, street-pack-ticket ×10, block-party-crowned ×1, and story-key:chapter-two ×1. A perfect first run with the alley and ceremony yields 17 tickets.

Nerd is a tournament card prize, not in the current boss deck. Chapter Two is now playable, and the ceremony's chapter key opens that route after the final line completes.

## Release verification after implementation

- Play the required path and verify only a win advances each battle's story.
- Read all new dialogue on a narrow screen; no clipping or automatic expiry.
- Skip the alley, finish the chapter, then play the alley: all three orders remain coherent.
- Verify the memorial precedes the return, Red's reaction differs from Blue's, and no later scene re-announces survival as new information.
- Compare a regular boss win and a perfect win: canonical ending identical, star/ticket reward differences correct.
- Check replay and existing-account dialogue progress after the chosen migration.
- Check first claims and repeat claims without granting duplicate rewards.
- Verify fallbacks for missing layers and absence of an active Chapter Two route claim.

These are implementation checks to run after integration. This writing pass checked the documents, references, dialogue tokens, portraits, and mechanical contract; it did not playtest new content that is not yet loaded.
