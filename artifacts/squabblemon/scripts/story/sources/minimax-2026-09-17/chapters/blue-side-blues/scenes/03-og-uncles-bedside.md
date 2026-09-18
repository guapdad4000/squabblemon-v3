# SCENE — `blue-side-blues:og-uncles-bedside`

> The chapter finale. Doubles as a battle + reward ceremony. The
> player, Blue, and Wifey enter OG Uncle's room. OG Uncle shares
> the truth: Cracked Head is alive, in witness protection, and
> OG Uncle tipped the feds to save him. Blue grieves. OG Uncle
> unlocks as a playable rival portrait. Baby Momma waits in the
> hallway.

---

## 1. Stage

```yaml
parallaxSceneId: blue-side-blues:og-uncle:bedside
venueId: hospital-room
mood: night
durationMs: 8400                                # longer than usual — the chapter's payoff
grain: 0.05
```

### Layer stack (back → front)

```yaml
layers:
  - id: sky
    depth: 0
    parallaxX: 0.05
    parallaxY: 0
    widthFactor: 1.4
    anchor: { x: 0.5, y: 0.5 }
    cacheable: true
  - id: hospital-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: bed
    depth: 0.6
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.95
    anchor: { x: 0.5, y: 0.65 }                       # the hospital bed, centered
  - id: og-uncle
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.5, y: 0.55 }                       # OG Uncle in the bed, propped up
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                        # Blue at the bedside
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.82, y: 0.7 }                       # Wifey by the door, watching
  - id: dialog-box
    depth: 1
    parallaxX: 1
    parallaxY: 1
    widthFactor: 0.9
    anchor: { x: 0.5, y: 0.9 }
```

### Camera waypoints

```yaml
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.5, y: 0.55, zoom: 1.35, holdMs: 3000, ease: easeInOut }   # tight on OG Uncle in the bed
  - { x: 0.18, y: 0.6, zoom: 1.15, holdMs: 1600, ease: easeInOut }    # cut to Blue at the bedside
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 2000, ease: easeInOut }     # settle center, the truth lands
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: blue-side-blues:og-uncles-bedside:pre:0
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.hospital.monitor
    text: |
      You came. I knew you'd come. Wifey wouldn't let you stay
      home. That woman's been carrying this block longer than
      either of you.
  - lineToken: blue-side-blues:og-uncles-bedside:pre:1
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.tape.play
    focusLayer: og-uncle
    text: |
      Blue. Sit down. I'ma tell you something I shoulda told
      you four years ago. Your brother ain't dead. He's in
      witness protection. I'm the one who tipped the feds.
  - lineToken: blue-side-blues:og-uncles-bedside:pre:2
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.card.flip
    text: |
      Two districts. He only needed one. And I needed to keep
      him alive. That's the truth. Hold it or leave it.
  - lineToken: blue-side-blues:og-uncles-bedside:pre:3
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    text: |
      (From the doorway.) He's in the hallway. The mother of
      his kid. Don't make her wait. She knows the rest.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: blue-side-blues:og-uncles-bedside:pre:0, atMs: 0,    soundHook: story.hospital.monitor }
  - { lineToken: blue-side-blues:og-uncles-bedside:pre:1, atMs: 2000, soundHook: story.tape.play, focusLayerId: og-uncle }
  - { lineToken: blue-side-blues:og-uncles-bedside:pre:2, atMs: 4600, soundHook: story.card.flip }
  - { lineToken: blue-side-blues:og-uncles-bedside:pre:3, atMs: 6400, soundHook: story.crowd.ambience }
```

---

## 3. Reward ceremony (no battle — this is a `kind: reward` node)

```yaml
ceremony:
  id: og-uncles-bedside
  kind: reward
  title: "OG Uncle's Bedside"
  mapPosition: { x: 78, y: 25 }
  prerequisites: [wifeys-push]
  optional: false

  # The full finalePayout from chapter-3-blue-side-blues.md.
  # Total tickets: 2 (auto from scenes 01 + 02) + 1 (this finale) = 3.
  rewards:
    - { kind: pack-ticket,       id: street-pack-ticket,       amount: 1 }   # the 3rd of 3 tickets
    - { kind: character-unlock,  id: og-uncle,                 amount: 1 }   # OG Uncle unlocks as a playable rival
    - { kind: chapter-key,       id: story-key:chapter-four,   amount: 1 }

  # Drama flavor — engine reads whether the player won scenes 01 + 02 clean.
  flavor:
    on-clean-path:
      og-uncle-line: "Two districts. He only needed one. Hold that."
      blue-line: "He's in the hallway. The mother of his kid. Don't make her wait."
      wifey-line: "We did it. Now we go face her."
    on-loss-path:
      og-uncle-line: "Two districts. I only needed one. I'm sorry."
      blue-line: "I held this block for four years for a lie."
      wifey-line: "We did it the hard way. Now we go face her."
```

---

## 4. Drama notes

- **The reveal:** OG Uncle tells Blue — and the player — that
  Cracked Head is alive. Witness protection. OG Uncle tipped the
  feds. Per the resolved-decision log, this is canon: OG Uncle
  tipped the feds to save Cracked Head; Blue discovered the
  arrangement and Snitch spread the rumor that Cracked Head
  died. Blue's betrayal in chapter 7 is his guilt catching up.
- **The line:** "Two districts. He only needed one" is the
  mid-season echo of the chapter-1 line "Two districts. Don't
  make me say it twice." It's the season's first formal callback
  on the recurring line. Chapter 8 closes the loop: "Zero
  districts. That's what you get for snitching."
- **The character unlock:** OG Uncle becomes a playable rival
  portrait. He's the third corner boss to unlock (after Cracked
  Head in chapter 1 and — coming up — Baby Momma in chapter 2's
  finale, OG Uncle here).
- **The setup:** Blue's "He's in the hallway. The mother of his
  kid. Don't make her wait" is the setup for chapter 5's "Baby
  Momma drops the kid bombshell" beat. Baby Momma is waiting.
  She has the second revelation: Cracked Head is the father of
  her kid.
- **The handoff:** Chapter 4 (Side Show) unlocks. Snitch sells
  fake receipts. Church Auntie officiates a fake funeral. The
  player has to figure out which is real.