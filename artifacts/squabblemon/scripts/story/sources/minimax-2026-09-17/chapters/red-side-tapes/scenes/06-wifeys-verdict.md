# SCENE — `red-side-tapes:wifeys-verdict`

> Mini-boss battle. Wifey — Ganger Blue's wife, the block's voice
> of reason — forces the player to commit. Her disposition toward
> the player is derived from the `tapeReveal` path flags set in
> scenes 02 and 03: both clean = she sides with the player; any
> loss = she judges against. Either way, Baby Momma plays the card
> in scene 07.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:wifey:verdict
venueId: corner-store-court                  # neutral ground, the block's courthouse
mood: dusk
durationMs: 7200
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
  - id: storefront
    depth: 0.4
    parallaxX: 0.4
    parallaxY: 0.2
    widthFactor: 1.1
    anchor: { x: 0.5, y: 0.65 }
  - id: lawn-chair
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.4
    anchor: { x: 0.2, y: 0.65 }                        # the lawn chair Wifey sits in to judge
  - id: wifey
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.5, y: 0.55 }                        # Wifey centered, behind the lawn chair
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.85, y: 0.65 }                       # Snitch on the wall, camera rolling
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
  - { x: 0.5, y: 0.5, zoom: 1.35, holdMs: 2800, ease: easeInOut }   # tight on Wifey, judgment pose
  - { x: 0.85, y: 0.55, zoom: 1.1, holdMs: 1200, ease: easeInOut }  # cut to Snitch on the wall
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 1400, ease: easeInOut }   # settle back on Wifey
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: red-side-tapes:wifeys-verdict:pre:0
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.door.close
    text: |
      Sit down. Both tapes played. The block knows what's on them.
      And Snitch already sold it to whoever's buying this week.
  - lineToken: red-side-tapes:wifeys-verdict:pre:1
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.crowd.ambience
    focusLayer: wifey
    text: |
      You went to Red's court clean. You went to Blue's court
      clean. That tells me you actually want to know the answer.
      Not everybody does.
  - lineToken: red-side-tapes:wifeys-verdict:pre:2
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.tape.scrub
    text: |
      But there is no answer. There's just a card. And only one
      of you has earned it. So fight me for it — and I'll know
      if you're ready for what's coming next.
  - lineToken: red-side-tapes:wifeys-verdict:pre:3
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.play
    focusLayer: snitch
    text: |
      (From the wall.) Camera's rolling.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:wifeys-verdict:pre:0, atMs: 0,    soundHook: story.door.close }
  - { lineToken: red-side-tapes:wifeys-verdict:pre:1, atMs: 1800, soundHook: story.crowd.ambience, focusLayerId: wifey }
  - { lineToken: red-side-tapes:wifeys-verdict:pre:2, atMs: 3800, soundHook: story.tape.scrub }
  - { lineToken: red-side-tapes:wifeys-verdict:pre:3, atMs: 5600, soundHook: story.tape.play, focusLayerId: snitch }
```

---

## 3. Battle

```yaml
battle:
  id: wifeys-verdict
  title: "Wifey's Verdict"
  battleType: mini-boss
  mapPosition: { x: 72, y: 31 }
  prerequisites: [the-watch-party]
  optional: false
  enemy:
    name: Wifey
    portraitAssetId: assets/characters/wifey.webp
    behaviorProfile: balanced
    deck:
      - wifey
      - baby
      - snow
      - plug
      - snitch
      - oink
      - cornball
  cinematic:
    videoAssetId: assets/story/chapter-two/media/wifey-verdict.mp4
    posterAssetId: assets/story/chapter-two/media/wifey-verdict.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    # Engine reads the player's tapeReveal state from scenes 02 + 03 and applies one of:
    #   - if both clean wins:   playerCostReduction: 1   (Wifey sides with the player)
    #   - if either loss:       wifeyPowerBoost: 2       (Wifey judges against the player)
    # Static modifier shown here is the favorable branch.
    playerCostReduction: 1
  phases: []
  starObjectives:
    - { id: win,       description: Win the verdict. }
    - { id: districts, description: Hold all three districts while Wifey judges. }
    - { id: squabble,  description: Win without using SQUABBLE — earn it clean. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 125 }
    # NOTE: Wifey unlocks at finale (tape-returned), not here. Mini-bosses don't unlock.
  teaching:
    tips:
      - "Cost reduction is Wifey's gift when you earned both tapes. Spend it on your heavy On-Reveal."
      - "If Wifey judges against you, she runs +2 power across her whole deck. Tempo wins."
      - "Win this clean or not — Baby Momma still plays the card. The flavor changes."
    focusMechanics: [cost reduction, district denial, On-Reveal timing]
    focusCards: [cornball, snow, wifey]
```

---

## 4. Drama notes

- **The mini-boss:** Wifey is the block's voice of reason. She
  doesn't fight for territory — she fights for clarity. Her deck
  is balanced, not aggressive. The challenge is tempo, not power.
- **The path resolution:** The engine reads the player's path flags
  from scenes 02 and 03 and applies the appropriate modifier
  branch. The screenplay shows the favorable branch as the default
  static value; the runtime overrides based on actual history.
- **The flavor setup:** This scene sets the flavor branch for
  `baby-momma-plays-the-card`. If both prior scenes were clean
  wins, the boss's card text reads "He kept the receipts." If
  either prior scene was a loss, the card text reads "He kept
  the lie." Either way, the card itself is the same.
- **The Snitch anchor:** Snitch's "Camera's rolling" line is the
  chapter's final setup — the boss fight's intro will pick up
  from there. Snitch is also the season's running meta — he sells
  to everyone, including the audience.