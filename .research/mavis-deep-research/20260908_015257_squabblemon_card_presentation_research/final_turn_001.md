# AAA Card Presentation for Squabblemon: A Synthesis of Marvel Snap, Naruto: Ninja Cards, and Attachment Research

The user is shipping a real product (Squabblemon, React/Vite/TypeScript, three-lane card battler, solo dev) and wants the card display, gameplay loop visuals, and character animation to feel professional and to make players *attach* to the characters. This report synthesizes the public design material behind Marvel Snap (Second Dinner), Naruto: Ninja Cards (Bandai, 2026), and Pokémon TCG Pocket, then layers in the academic and practitioner literature on player–character attachment. It closes with concrete, codebase-aware recommendations for Squabblemon.

## The core finding, stated up front

Characters feel alive in card games when three things co-occur: a **distinct visual identity per character**, a **signature verb that always plays when they show up**, and **responsive reactions to the moment-to-moment state of the match**. Marvel Snap does all three at a level that won Apple Design Award 2023 for Innovation [1][2]. Naruto: Ninja Cards is currently doing one of the three (signature jutsu) but not the other two, and beta reaction notes the gap explicitly [3]. Squabblemon has the bones for all three (art direction, ability callouts, and live score reactions) but the *character-acting* layer is still mostly shared — the same lift-and-slam, the same impact ring, the same lane FX art for everyone. The biggest single upgrade to "people get attached" is to give every character their own *acting* moment.

## How Marvel Snap earned "comics of the future"

Tiffany Smart, who owned the UI/UX design system for Marvel Snap, describes the visual target as "what would comics of the future look like" [4]. Two practical design decisions follow from that question. First, **cards take precedence in the visual hierarchy**: every UI element exists to highlight a card, not compete with it. The "piano glass" dark UI, holographic light buttons, and halftone dot textures are scaffolding for the cards, never the opposite [4]. Second, **location borders and power gems glow in the direction of the winning player** so the leading side of the board is always visually obvious without any number being read [4]. This is the discipline: read state at a glance, not by parsing.

The card itself uses 3D parallax, frame breaking, and height mapping from the base tier up. Upgrading a card's quality tier adds cosmetic FX visible in collection and in-battle, to opponents [4]. Each character has a hand-illustrated unique animation: Hulk slams with a green-glow crack [2], Ghost Rider yanks a discarded card back with a chain [2], Nakia hurls ring blades that pulse through each card [5], Killmonger roars and throws spear tips that stab affected cards [5], Shang-Chi hits with a distinct impact [6]. Apple's award citation specifically names "Hulk smash in 60 fps" as a hero moment [2]. The point of all this is not decoration. The point is that each character does *their thing*, in motion, every time they appear.

The gameplay loop has its own shape. Each turn is simultaneous: both players drop cards face-down across three locations, then they flip together [7]. That single design choice creates the "moment budget" for everything else — a player can spend their anticipation on the reveal rather than on a 30-minute back-and-forth. The Snap button (lifted from backgammon's doubling cube) doubles the stakes, gets a dramatic light show and haptic burst, and is the explicit emotional peak of the match [7][5]. Haptics are present on every meaningful interaction: a sharp tap on Play, a thunderous boom on slam, a slicing thrum when a card is destroyed [5]. None of this is gratuitous — it is a continuous, low-cost layer of "you are doing something with weight."

## How Naruto: Ninja Cards does and does not deliver

Naruto: Ninja Cards (Bandai, 2026) is the obvious mobile reference: three lanes, three minutes per match, summon a character, push down the lane, activate a Jutsu at the right time [8]. The deck-building and chakra model comes from the physical Naruto Card Game (Bandai, 2024–26): a 51-card deck plus 5 chakra plus 1 summon, attack the leader down to 0 life, with EX characters that can swing the game when their conditions are met [9].

What the mobile version does well, on paper: each character variant has a **signature jutsu with a specific name and animation**. Naruto's Shadow Clone Jutsu sends clones forward [8]. Sasuke's Fireball Jutsu erupts on impact [8]. Kakashi's Thousand Years of Death is literally named in the deck list as a card [10]. The "Ninja Voltage" sister-game, even earlier, showed what full jutsu cinematics look like: an EX Ultimate Jutsu for Sasuke combines an Amaterasu fire pillar with a black-flame Chidori charge [11]. This is the pattern the user wants for Squabblemon — every card should be a *named action*, not a stat block.

What the current mobile beta is missing is the rest of the acting layer. Multiple playtest videos from 2026 flag the same complaint: cards just *disappear* when defeated, lane clashes look like a "simple disappearing act", and there is no per-card feedback for what just happened [3]. One streamer explicitly says, "I'm expecting some like card fights going on, not just like simple disappearing act" [3]. Naruto: Ninja Cards currently has *signature moments on demand* (jutsu) but *no ambient personality* (no idle animation, no hit reaction, no "I just lost the lane" pose) and *no signature entry* (cards just appear). The lesson is not that jutsu are bad — they are essential — but that jutsu alone are not enough to make the world feel inhabited.

Pokémon TCG Pocket demonstrates a different layer of the same lesson. Its "Immersive Cards" are a rarity tier where tap-and-hold expands the card to full screen, plays a short animated scene with music, and pans the camera through the illustration's world [12][13]. A Pikachu immersive card reveals a forest scene with Ponyta and Nidoran in the background [13]. These are *not* gameplay cards — they have no in-battle benefit, only "looking cool" [13]. The point is that the collectible loop and the playing loop are two separate things, and they each need their own presentation. The playing loop is Snap-style feedback; the collectible loop is TCG Pocket's scene cards. Both are needed if you want people to *keep wanting to own* the card.

## The character-attachment layer: what the research actually says

The gacha and character-game literature is unusually consistent. Bobb et al. (Aalto) found **seven distinct forms of player–character emotional attachment**: excitement about gameplay competence, admiration as a role model, deep concern for well-being, and four more [14]. Cao and Xu describe the *affection economy* — players spend money on virtual characters because of substantial emotional connection [15]. Tan (2023) found the need for relatedness is satisfied through "parasocial relationships with in-game characters" [15]. A second Aalto thesis, "Make Them Care," produced an eight-part toolbox for emotional investment: micronarratives, environmental storytelling, distinct and responsive characters, attachment through growth, difficult choices, ethical engagement, mood/affective design, and player agency [16].

The most actionable of these for Squabblemon is **distinct and responsive characters**. The thesis defines it as characters whose behavior varies based on the situation they are in and on the player's actions [16]. Combined with the Gwent pattern — every character has a voice line, often multiple lines, and the lines are played at the moment the card enters play [17] — the implication is that a character in a digital card game has a *personality contract* with the player. The contract has at least three parts:

1. **A signature entry**: a unique, repeatable animation that always plays when the character is played. (Marvel Snap's Hulk smash; Naruto's Jutsu.)
2. **A state-reactive idle**: when the character is on the board and the world changes (turn ends, lane flips, ally loses, ability triggers), the character *does something* in response.
3. **A sign-off**: a unique animation when the character is destroyed, moved, or silenced. (Snap's "X-23 just appears out of thin air" is a community complaint because she lacks this [18].)

Time investment deepens attachment [15]; Squablemon's per-card ability upgrade tree and per-card progression are already serving this. But investment is the *fuel*, not the spark. The spark is the personality contract being kept. A card you can level up but whose play moment is identical to every other card does not become loved.

## The five dimensions to design on

A design framework for card presentation, ordered by leverage:

1. **Identity (the card)**: portrait art, frame treatment, parallax/3D, ability text placement, cost and power chrome. The card is a *portrait of a person*, not a stat sheet. Marvel Snap's base card already explodes out of the page; Smart's team redraws the background art for parallax layers [19]. Squabblemon already has variant portraits and the ability-upgrade tree; the missing piece is making the *default* card feel like a portrait, not a token.

2. **Entry (the play moment)**: the most-watched animation of any character. Snap spends 0.6–0.9 seconds on a slam with impact ring and camera bump. Naruto spends 1.5–3 seconds on a full jutsu cinematic for the EX characters. The beat must have a *name* (the ability text), a *who* (the character), and a *what happened* (the effect). This is the moment the community captures and shares. The user's prior turn already added a callout banner with the card name and the effect note during the impact beat; the next step is to make the *card itself* act during that beat, not just the banner.

3. **Idle / reactivity (life on the board)**: what the character does between plays. Disney's twelve principles apply directly here — anticipation, follow-through, secondary action, slow in/out, arcs, exaggeration [20][21]. A card on the board that *doesn't move* is a sticker. A card on the board that *breathes* (subtle scale or bob), that *reacts when the score changes* (lean toward the leader, flinch when losing), and that *cashes out secondary actions* (a particle trail, a status icon, a glow when its ability is on cooldown) feels inhabited. These are cheap, repeatable CSS keyframes.

4. **Reactive narrative (the rare moment)**: when something dramatic happens — a final-turn swing, a perfect block, a lane-flip — the system should trigger a *unique* response. Marvel Snap's Snap-button cinematic is the canonical example: the doubling-cube moment has its own animation, its own light show, its own haptic [7][5]. Squabblemon's "Squabble" button already exists; what it lacks is a comparable cinematic, and that's exactly the kind of one-time beat that gets shared on social media and remembered.

5. **Collection (the "looking at it" loop)**: separate from playing. TCG Pocket's immersive cards show the path: rarity-tier content where the card itself becomes a small interactive scene [12][13]. This is the highest-leverage investment if Squabblemon's revenue comes from cosmetics, because it makes people *want to own* the card beyond its gameplay value. It is also the cheapest to add for any card where a single parallax layer can be sliced off the existing art.

## Squabblemon-specific recommendations

Mapped to the user's existing codebase (which already has staged card animation, ability callouts, score ticking, and a 3-lane battlefield) — these are the highest-leverage next changes.

| Dimension | Recommendation | Codebase hook |
|---|---|---|
| Identity | Give every card a one-frame "portrait pop" on hand draw — slight scale + glow that says "this is a person, not a card." | `CardView` initial animation, plus a per-card `portraitAccent` color pulled from the card's `type` (Fire/Dark/Electric/Water) or `accent`. |
| Entry | Add a per-card `entryVfx` asset reference (sprite/animation). On lock-in, the staged card's CSS animation picks the asset. Wifey gets a shield, the Landlord gets a gavel, etc. | Extend `EffectLogEntry.kind` with new variants, or add a new `cardId → entryVfx` map in `data.ts`. Reuse the existing lift keyframe, swap the impact art. |
| Idle | Add an "alive" CSS keyframe per side: subtle 4s breathing scale on board cards. Add a "lean toward leader" keyframe triggered when `pScore` or `cScore` flips. | New keyframes in `index.css`; class binding on `CardView` based on `pScore > cScore` and `m.phase`. |
| Reactive narrative | On a Squabble play, the impacted lane scales to 1.08 with a 1.2s slow-mo on the score tick. Add a one-shot "victory ring" SVG to the winner. | `PlayLoop.tsx` `presentEvents` for the squabble path; new `squabble-cinematic` beat; new keyframe. |
| Collection | When a card is inspected in `CardInspector`, if it has an `immersiveAssetId`, show a 3-second parallax loop of the character at idle. | `CardInspector.tsx` and `data.ts`. Reuses existing `getAssetUrl`. |

The single most important habit to install: every new card art file should ship with a **3-second action reference** — the artist's interpretation of what the character does *when they are played*. This is what makes Naruto's EX jutsus feel like the character is doing the move, not the move happening to the character. Squabblemon can do this in two layers: cheap CSS keyframes for the structural motion (lift, slam, idle) and a per-card animated GIF or short Lottie for the signature. The structural layer is shared infrastructure; the signature layer is the character's soul. Most cards can be carried by the structural layer alone; the cards that get premium treatment are the ones people pay for and remember.

## One core takeaway

The card games that win hearts do not have better cards; they have *characters who do things*. Marvel Snap's Hulk smashes, Naruto's Shadow Clones charge, TCG Pocket's Pikachu runs through a forest scene — the card is a vehicle for an act, not a stat block with art. Squabblemon's next step is to spend less energy on what the *board* looks like and more on what each *character* does on it. Build the personality contract (signature entry, responsive idle, named reaction) into the data model so every new card automatically inherits the framework, and the characters will start selling themselves.

---

## References

[1] Tiffany Smart, Marvel Snap UI/UX portfolio — https://www.tiffanysmart.com/work/marvel-snap

[2] Apple, "Meet this year's Apple Design Award winners" (2023), Marvel Snap — https://apps.apple.com/in/story/id1687371285

[3] Naruto: Ninja Cards beta gameplay (2026), "literally Marvel Snap but Naruto skin" and the "disappearing act" criticism — https://www.youtube.com/watch?v=BczQb1oGEGo

[4] Tiffany Smart, Marvel Snap design philosophy: "comics of the future", halftone, piano-glass — https://www.tiffanysmart.com/work/marvel-snap

[5] XDA Developers, "How one mobile game left me with a transcendent haptic experience" (Marvel Snap haptics) — https://www.xda-developers.com/marvel-snap-mobile-game-haptics/

[6] Marvel.com, "Inside the Art of Marvel Snap" (frame break, 3D, animation FX) — https://www.marvel.com/articles/games/inside-the-art-of-marvel-snap

[7] Glenn Jones (Second Dinner), "Designing Marvel Snap" — https://www.youtube.com/watch?v=HjhsY2Zuo-c

[8] NARUTO: Ninja Cards official description — https://www.youtube.com/watch?v=0y42tp7Jll8

[9] Bandai, "NARUTO CARD GAME Shows Its Hand" (PR Newswire, 2026) — https://www.prnewswire.com/news-releases/naruto-card-game-shows-its-hand-302837560.html

[10] "Thousand Years of Death" Kakashi deck profile, Naruto: Ninja Cards — https://www.youtube.com/watch?v=8Pkj8_Bx43M

[11] Bandai, "New Sasuke Uchiha (Rinne Sharingan) Ninja Cards" (Amaterasu + Chidori) — https://naruto-official.com/en/news/01_1674

[12] Bulbapedia, Immersive card (TCG Pocket) — https://bulbapedia.bulbagarden.net/wiki/Immersive_card_(TCG_Pocket)

[13] The Pokémon Company, "The Pokémon TCG Comes to Smartphones" (parallax, "step into the world of the card's illustration") — https://corporate.pokemon.co.jp/en/topics/detail/t-28/

[14] Bobb et al., Aalto SCI, "Exploring Emotional Player–Character Attachment" (seven distinct forms) — https://acris.aalto.fi/ws/portalfiles/portal/38172805/SCI_Bobb_Exploring_Emotional.pdf

[15] UC Santa Cruz, gacha/character attachment research (parasocial relationships, affection economy, time investment) — https://escholarship.org/content/qt47n870q2/qt47n870q2.pdf

[16] Aalto thesis, "Make Them Care: A Toolbox for Fostering Emotional Connections" (eight-part toolbox, distinct and responsive characters) — https://aaltodoc.aalto.fi/items/28a7f41a-2a42-4a23-b45c-8ce017ec50c7

[17] Gwent voice-line database, character-on-play personality — https://gwent.one/en/

[18] Reddit r/MarvelSnap, "What cards are in dire need of Visual Effects?" (X-23 "appears out of thin air" complaint) — https://www.reddit.com/r/MarvelSnap/comments/17ld2ve/what_cards_are_in_dire_need_of_visual_effects/

[19] Tiffany Smart on background redraw for parallax — https://www.tiffanysmart.com/work/marvel-snap

[20] Interaction Design Foundation, "UI Animation — How to Apply Disney's 12 Principles" — https://ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design

[21] UI Wiki, "12 Principles of Animation" (anticipation, follow-through, secondary action, exaggeration) — https://www.userinterface.wiki/12-principles-of-animation
