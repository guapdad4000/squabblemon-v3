# SCENE — `block-party:snitch-at-the-corner`

> Mini-boss battle. Snitch has been watching the feed (the
> setup from scene 05 pays off here). He cashes the chatter in
> for +2 CPU motion at round 4. The player's path through scenes
> 02 and 04 determines whether Snitch's intel is dated (player
> won both) or fresh (player lost either). Either way, the player
> has to deal with the consequence of being recorded.

---

## 1. Stage

```yaml
parallaxSceneId: block-party:snitch:at-the-corner
venueId: corner-store-court
mood: dusk
durationMs: 6400
grain: 0.08                              # projector footage bleed
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
    widthFactor: 0.85
    anchor: { x: 0.5, y: 0.45 }                  # the footage from the side-alley rolls here
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }                  # same vending machine (callback chain)
  - id: snitch
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                  # Snitch in front of the screen, cashing in
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
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }   # tight on Snitch
  - { x: 0.5, y: 0.45, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # cut to the projector screen
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: block-party:snitch-at-the-corner:pre:0
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.play
    text: |
      I been watching the feed. Side alley, corner store,
      vending machine — every camera. You didn't think I was
      playing, right?
  - lineToken: block-party:snitch-at-the-corner:pre:1
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.crowd.ambience
    focusLayer: snitch
    text: |
      Now I'ma cash this in. Round four. Plus two motion. The
      alley, the corner, the block — all on tape.
  - lineToken: block-party:snitch-at-the-corner:pre:2
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.rewind
    text: |
      You wanna keep the receipts? Beat me first.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:snitch-at-the-corner:pre:0, atMs: 0,    soundHook: story.tape.play }
  - { lineToken: block-party:snitch-at-the-corner:pre:1, atMs: 1800, soundHook: story.crowd.ambience, focusLayerId: snitch }
  - { lineToken: block-party:snitch-at-the-corner:pre:2, atMs: 3600, soundHook: story.tape.rewind }
```

---

## 3. Battle

```yaml
battle:
  id: snitch-at-the-corner
  title: "Snitch at the Corner"
  battleType: mini-boss
  mapPosition: { x: 72, y: 31 }
  prerequisites: [red-side-retaliation]
  optional: false
  enemy:
    name: Snitch
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
  cinematic:
    videoAssetId: assets/story/chapter-one/media/snitch-at-the-corner.mp4
    posterAssetId: assets/story/chapter-one/media/snitch-at-the-corner.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    # Engine reads the player's redTape/blueTape path state and applies one of:
    #   - if both clean wins:   snitchMotionBoost: { round: 5, amount: 2 }   (intel is dated, comes a turn late)
    #   - if either loss:       snitchMotionBoost: { round: 4, amount: 2 }   (intel is fresh, hits at round 4)
    # Static modifier shown here is the fresh-intel branch.
    snitchMotionBoost:
      round: 4
      amount: 2
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while Snitch's motion boost is active. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 125 }
    # NOTE: Mini-bosses don't unlock characters. Snitch unlocks in chapter 2 (scene 01).
  teaching:
    tips:
      - "Snitch's motion boost hits at round 4 (or 5 if you won both prior battles clean)."
      - "Counter with cheap tempo in rounds 1-3, then drop your finisher at round 5+."
      - "If Snitch's intel is dated, you have one extra turn to set up."
    focusMechanics: [motion timing, district denial, late-game finisher]
    focusCards: [cornball, snow, snitch]
```

---

## 4. Drama notes

- **The payoff:** "Watching the Feed" from scene 05 pays off here.
  Snitch cashes the chatter in for +2 motion. The player has to
  deal with the consequence of being recorded.
- **The path resolution:** The engine reads the player's path
  flags from scenes 02 (`blueTape`) and 04 (`redTape`) and applies
  the appropriate motion-boost timing. The screenplay shows the
  fresh-intel branch as the default static value; the runtime
  overrides based on actual history.
- **The setup:** The projector screen in this scene is the same
  screen Snitch uses in chapter 2's `the-watch-party` scene. The
  season is establishing Snitch's meta — he sells to everyone,
  including the audience.
- **The corner store lock:** The corner-store-court is the
  meeting ground for every Snitch appearance across the season.
  He never moves the projector. The block does.