# Red Side Tapes — production and game handoff

2026-09-08 writing handoff. As of 2026-09-18, the local campaign loads this screenplay and its six drafted fights, plus an optional courier table. Dedicated Chapter Two scene art and a full authenticated playthrough remain to be verified.

## Read first

[Full read-through](CHAPTER_TWO_READTHROUGH.md), [chapter contract](chapter-2-red-side-tapes.md), and [story bible](../../STORY_BIBLE.md). [Screenplay JSON](chapter-two.screenplay.json) preserves stage directions, dialogue delivery, phase jokes, and continuity notes. [Proposed chapter JSON](chapter-two.proposed.json) is shaped for StoryChapter authoring but is not a deployment artifact.

## Clip boundaries

Make **15 normal segments**: six pre-fight, six victory, two standalone conversation clips (Scenes 1 and 5), one ending (Scene 9). Six optional defeat jabs and two optional boss-phase lines are separate presentation hooks. Scene 1 opens immediately after the Chapter One ceremony's last frame. Do not repeat the whole previous scene or defer the promised playback.

Scene 9 contains the event recognition and porch visit in one scripted reward node. Grant its real rewards only on completion after the final beat, then show the reward panel. Keep the porch cliffhanger visually intact. The player has earned the host position before the visit; nobody is forced to confess by a card result.

## Art direction and missing assets

Use the current game identities, including Cornball's literal corn/clown design, Cracked Head's masked/ragged silhouette, and Blue's existing bandana. Dialogue about appearances is comic speech, not a request to replace the designs. Preserve the original handed-off Chapter One finale's framing in the opening.

Existing portrait files: ganger-blue, ganger-red, cracked-head, snitch, cornball, wifey, baby-momma, all-jokes-roaster, church-auntie, og-uncle. New poses/expression sheets are still needed. Baby Momma's source includes a stroller; this chapter's adult conversations and final table do not include a visible child or stroller. Keep the child unnamed and off-screen. Roaster's maternal-sibling relationship does not authorize changing either character's supplied appearance.

Existing battle plates provide only combat continuity. Chapter Two needs daytime versions of the red court and corner store, a shaded harbor canopy, a private store back room, sunset rooftop final, and OG Uncle's porch. Those last two interior/porch settings have no approved standalone scene art yet. The current night venue references must not silently turn a morning argument into midnight.

Props to create: tiny old digital recorder and labeled sleeve, power bank, sealed water bottles, NO FAMILY QUESTIONS/CHECK-IN sign swap, printed six-table gauntlet card, cheese dispenser and laminated tier chart, founder chair, face-down media sign, fake apology-inspector badge, covered plates, empty place setting, check-in roll of tape, volunteer coolers, showcase host card, newspaper and porch chairs. Reuse approved existing chairs, phones, deck stacks and ring-light designs once the Chapter One video agent establishes them.

Stage the comedy as sincere action with escalating consequences. Use actual reactions for Blue's guilt, Baby Momma listening to the message, Red's refusal to answer immediately, and Wifey being trusted. Do not put a cartoon sting on every serious line.

## Voices and recordings

The archive contains one historical message spoken by Cracked Head. It uses his established voice through a small-recorder sound treatment. The player's engine-facing line object does not include delivery metadata; retain a presentation cue keyed to its dialogue token so it is not performed as present-day speech. No voice/audio files are supplied in this writing pass.

There are three different recordings in season continuity:

| Recording | Owner / audience | Purpose |
| --- | --- | --- |
| Old message to Red | Baby Momma takes physical custody; private circle in Scene 1 hears it | Establishes survival, knowledge of the child, and the concealed request to contact her. |
| Public gauntlet stream | Snitch records Red's Scene 4 public statement | Plants selective editing. Snitch does not have the old message. |
| Warehouse-era footage | Later-chapter evidence, not played or recovered here | Chapter Four/Five source-chain and rescue story. |

Do not merge these, play hidden material, or have Snitch quote a message he did not hear.

## Game integration

Chapter ID red-side-tapes, order 2, prerequisite block-party. Keep the existing Chapter Two key compatible with the new chapter progression; check actual server unlocking semantics instead of assuming possessing a key automatically makes a chapter active. Append to storyContent only in a separate implementation pass. Increment/version authored dialogue appropriately and preserve Chapter One rewards and progress.

All Chapter Two node IDs are new, globally distinct, and sequential. All nodes are required. New portrait/story roster entries needed: cornball, wifey, baby-momma, all-jokes-roaster, church-auntie, og-uncle. Existing card keys use aliases such as baby and roaster; never substitute portrait slugs in decks.

Six standard three-star objective sets. Every normal victory advances and gets the same story. Red's middle lane closes in round three; Snitch gets +1 CPU Motion at rounds three and five; Roaster starts with +1 CPU Motion; Wifey starts with four cards; Baby Momma gets +1 CPU Motion at round three and a Wifey card reinforcement at round five. Cornball has no extra encounter modifier. Exact values remain untested proposals.

Chapter Two map, media, new phase speech and proposed chapter-key reward need integration. No new live resource or ability is created just because the script mentions a startup, host position, family claim, or recording. Any empty recommended collection/asset/roster resolution needs fixing before deployment.

## Verification

Completed checks for this draft: the actual engine content validator accepts Chapter Two alongside the current Chapter One; all six decks contain seven distinct existing card keys; all 158 normal lines and six defeat lines agree across screenplay, scene files, read-through, and proposed data where applicable; portrait references and document links resolve; the handed-off Chapter One ZIP's SHA-256 is unchanged. This validates structure and editorial consistency, not difficulty or playback.

Portable production exports: [dialogue CSV](dialogue.csv) contains 164 rows including six optional defeat lines. [Video segment manifest](video-segments.json) defines the 15 normal segments and their exact line tokens. The two optional boss-phase lines remain in the screenplay and read-through as separate hooks.

Editorial checks: nine nodes; six battles; seven distinct valid card keys per opponent; unique dialogue tokens; script/JSON line agreement; all scene/character/portrait links exist; no unintended changes to the Chapter One ZIP. Proposed content structure should be checked with the real engine validator alongside Chapter One. Passing structure does not prove balance or visual readiness.

After implementation: test new and returning profiles, chapter gating, dialogue save/retry, defeat-to-rematch, regular versus perfect boss win, ticket idempotency, phone/landscape reading, missing-media fallback, and that the old message plays exactly in its intended archival treatment. Do not imply Chapter Three is playable until its actual content ships.

