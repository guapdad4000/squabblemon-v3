# SCENE — `the-function:the-booking`

> Standard battle. Promoter — the booking authority — arrives
> at the function and books the return fight: Cracked Head
> vs Blue. Live Streamer narrates. The chapter's premise for
> Ch7 is locked in here.

---

## 1. Stage

```yaml
parallaxSceneId: the-function:booking:desk
venueId: function-venue
mood: night
durationMs: 6400
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
  - id: venue-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: booking-table
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.85
    anchor: { x: 0.5, y: 0.55 }                       # Promoter's booking table
  - id: promoter
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.5, y: 0.6 }                         # Promoter behind the table, paperwork
  - id: live-streamer
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.66 }                       # Live Streamer, narrating
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.82, y: 0.66 }                       # Snitch, selling the booking to whoever's buying
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
  - { x: 0.5, y: 0.55, zoom: 1.35, holdMs: 2400, ease: easeInOut }   # tight on Promoter
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 2200, ease: easeInOut }    # pull back to the booking table
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: the-function:booking:pre:0
    speaker: Promoter
    portraitAssetId: assets/characters/promoter.webp
    soundHook: story.paperwork.write
    text: |
      (Promoter sets down a stack of papers.) Alright — the
      booking. Cracked Head versus Ganger Blue. Two districts.
      One block. Whoever wins takes the season.
  - lineToken: the-function:booking:pre:1
    speaker: Live Streamer
    portraitAssetId: assets/characters/live-streamer.webp
    soundHook: story.stream.record
    focusLayer: live-streamer
    text: |
      (From the wall.) The booking is in. Chapter seven —
      the return. Cracked Head walks in. Blue answers.
      Whoever's in the room — you're witnessing this.
  - lineToken: the-function:booking:pre:2
    speaker: Promoter
    portraitAssetId: assets/characters/promoter.webp
    soundHook: story.crowd.cheer
    text: |
      Beat me first. Then we sign the paperwork. Then the
      season changes hands.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: the-function:booking:pre:0, atMs: 0,    soundHook: story.paperwork.write }
  - { lineToken: the-function:booking:pre:1, atMs: 2000, soundHook: story.stream.record, focusLayerId: live-streamer }
  - { lineToken: the-function:booking:pre:2, atMs: 4000, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: the-booking
  title: "The Booking"
  battleType: standard
  mapPosition: { x: 78, y: 25 }
  prerequisites: [the-bar-fight]
  optional: false
  enemy:
    name: Promoter
    portraitAssetId: assets/characters/promoter.webp
    behaviorProfile: balanced
    deck:
      - promoter
      - snitch
      - plug
      - baby
      - cornball
      - snow
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-six/media/the-booking.mp4
    posterAssetId: assets/story/chapter-six/media/the-booking.webp
    environmentAssetId: assets/venues/function-venue.webp
  modifiers:
    functionMode: true                # carries over
    liveStream: true                  # FLAG: everything is being recorded — open hands modifier
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while the booking is signed. }
    - { id: signed,    description: Win while the booking paperwork is in play. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Live-stream mode means everything's being recorded — open hands."
      - "Function mode carries — don't exile any cameo character."
      - "The booking is signed. Chapter seven's premise is locked in."
    focusMechanics: [function mode, open hands, signed paperwork]
    focusCards: [cornball, snow, promoter]
```

---

## 4. Drama notes

- **The booking mechanic:** `liveStream: true` is the
  chapter's booking twist. Everything is being recorded —
  open hands modifier carries through. The player can see
  Promoter's deck before he plays.
- **Promoter's role:** Per the season arc character list:
  "Promoter — books the return fight. Chapter 7." Promoter
  appears in Ch6 to set up Ch7's premise. He doesn't fight
  in Ch7 — the booking is the booking.
- **The premise:** "Cracked Head versus Ganger Blue. Two
  districts. One block. Whoever wins takes the season." is
  Chapter 7's full premise. Locked in here at the function.
- **Snitch's cameo:** Snitch is selling the booking to
  whoever's buying — per the resolved-decision log, he sells
  to everyone. He's already selling the return fight before
  Cracked Head has walked in.
- **The setup:** Scene 04 (cracked-head-walks-in) is the
  finale. Cracked Head enters. The season changes hands.
  Bottle Girl unlocks.