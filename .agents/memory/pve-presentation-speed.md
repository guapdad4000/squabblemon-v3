---
name: PvE presentation speed
description: What the player's battle-speed choice may and may not retime.
---

The PvE speed choice scales only broadcast choreography: presentation beats, the
arena's presentation-animation durations, and special-move clip playback rate.

**Why:** Speed is a pacing preference for the show, not a change to the game's
fairness or to comprehension time. Shortening the decision clock changes how hard
the match is; shortening guided reading or lesson holds breaks tutorials for slow
readers; online battles are paced by the server, so a client multiplier would
desynchronize presentation from authoritative timing.

**How to apply:** Route new presentation delays through the scaled beat helper,
and leave the turn timer, reading gates, lesson holds, and every online battle at
1x. Scale CSS with one duration variable set on the arena container (never
per-frame variables on the document root, which restyle the whole battle), and
keep the reduced-motion `animation: none` rules intact so the choice cannot
reintroduce motion.

Prove it by comparing computed animation durations at both speeds, not by
reading the variable: a beat can outrun an animation that never scaled, leaving
entrances cut off mid-flight.
