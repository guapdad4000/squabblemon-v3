# SCENE — `red-side-tapes:the-watch-party`

> Rule-twist battle. Both sides play the tape publicly. The middle
> district locks. The twist: On-Reveal effects fire twice for both
> players. This is the season's first formal "Tape Replay" beat —
> the same mechanic that will echo as Cracked Head's signature in
> `baby-momma-plays-the-card`.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:watch-party:public-screen
venueId: corner-store-court
mood: dusk
durationMs: 7200                            # longer than usual — both tapes play
grain: 0.08                                 # heavier grain — projected footage
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
  - id: storefront
    depth: 0.4
    parallaxX: 0.4
    parallaxY: 0.2
    widthFactor: 1.1
    anchor: { x: 0.5, y: 0.65 }
  - id: projector-screen
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.2
    widthFactor: 0.9
    anchor: { x: 0.5, y: 0.45 }                     # the public screen, lit up
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }                     # same vending machine (callback)
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.85, y: 0.62 }                    # Snitch running the projector
  - id: ganger-red
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.3, y: 0.62 }                     # Red on the left of the screen
  - id: ganger-blue
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.7, y: 0.62 }                     # Blue on the right of the screen
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.5, y: 0.78 }                     # Cornball in the front with the snacks
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the screen
  - { x: 0.3, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }    # pan to Ganger Red
  - { x: 0.7, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }    # pan to Ganger Blue
  - { x: 0.5, y: 0.6, zoom: 1.1, holdMs: 600, ease: easeInOut }      # settle on the screen
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: red-side-tapes:watch-party:pre:0
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.play
    text: |
      Alright, listen up. Both tapes. Same time. Sun's almost down
      and I'm only rolling it once.
  - lineToken: red-side-tapes:watch-party:pre:1
    speaker: Cornball
    portraitAssetId: assets/characters/cornball.webp
    soundHook: story.crowd.cheer
    text: |
      (Cornball shakes a bag of chips.) I got snacks. Don't nobody
      move. Don't nobody talk. Tape don't lie.
  - lineToken: red-side-tapes:watch-party:pre:2
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.tape.scrub
    focusLayer: ganger-red
    text: |
      Watch the corner. 1:14. That's my brother. That's the truth.
  - lineToken: red-side-tapes:watch-party:pre:3
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.tape.scrub
    focusLayer: ganger-blue
    text: |
      Watch the alley. 2:07. That's who's been running this corner
      since my brother "died."
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:watch-party:pre:0, atMs: 0,    soundHook: story.tape.play }
  - { lineToken: red-side-tapes:watch-party:pre:1, atMs: 1800, soundHook: story.crowd.cheer }
  - { lineToken: red-side-tapes:watch-party:pre:2, atMs: 3200, soundHook: story.tape.scrub, focusLayerId: ganger-red }
  - { lineToken: red-side-tapes:watch-party:pre:3, atMs: 4800, soundHook: story.tape.scrub, focusLayerId: ganger-blue }
```

---

## 3. Battle

```yaml
battle:
  id: the-watch-party
  title: "The Watch Party"
  battleType: rule-twist
  mapPosition: { x: 57, y: 42 }
  prerequisites: [blue-side-defense]
  optional: false
  enemy:
    name: Snitch (running the projector)
    portraitAssetId: assets/characters/snitch.webp
    behaviorProfile: balanced
    deck:
      - snitch
      - plug
      - baby
      - oink
      - cornball
      - snow
      - wifey
      - roaster
  cinematic:
    videoAssetId: assets/story/chapter-two/media/watch-party.mp4
    posterAssetId: assets/story/chapter-two/media/watch-party.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    onRevealDouble: true                # THE TWIST: On-Reveal effects fire twice for both players
    tapeReveal: both                    # both tape flags set — player has seen both sides
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while the tapes replay. }
    - { id: squabble,  description: Win without using SQUABBLE while the On-Reveals fire twice. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
    # NOTE: Snitch was already unlocked in scene 01. No unlock here.
  teaching:
    tips:
      - "On-Reveal doubling means your best On-Reveal cards double up — and so do theirs."
      - "Save your heavy On-Reveal for the back half of the turn cycle."
      - "Both sides have a tape. Both sides are lying about something. The truth is in the middle district."
    focusMechanics: [On-Reveal stacking, district denial, Motion timing]
    focusCards: [cornball, snow, roaster]
```

---

## 4. Drama notes

- **The rule twist:** `onRevealDouble: true` is the chapter's signature
  mechanic. It will return in `baby-momma-plays-the-card` as the
  boss's phase 2 modifier (Cracked Head's signature: replay the tape).
- **The middle district locks:** The watch party forces both sides to
  commit to their tape publicly. After this scene, the player has
  seen both sides. Wifey's verdict (scene 06) is now inevitable.
- **The crowd:** Cornball's "Don't nobody move. Don't nobody talk."
  is a callback to chapter 1's vending machine kick — he always
  finds a way to be the comic anchor even in serious scenes.
- **The truth:** Neither tape is complete. Both sides are lying about
  something. The middle district — the one the player holds — is
  where the actual footage lives. The boss fight (scene 07) will
  confirm this: the player's path determines which tape Baby Momma
  plays, but the card is the same either way.