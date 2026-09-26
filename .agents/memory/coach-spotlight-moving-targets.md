---
name: Coach spotlight moving targets
description: CoachSpotlight masks must track targets moved by inline-style mutations; tour targets gated on async scene data need a no-scene fallback that is actually visible and clickable.
---

An input-blocking coach mask must track moving targets. Async scene readiness alone does not mean its highlighted controls are positioned or clickable; some targets may have anchors while others do not.

**Why:** Players could not advance the guided tour when the mask hole stopped following a moving target, or when a scene stalled after reporting ready but before placing every marker.

**How to apply:** Coalesce target measurements when layout-affecting attributes change, ignoring the overlay's own updates. Give each async-positioned target its own visible, static fallback until that specific target receives usable placement. Verify real clicks through normal, blocked, anchorless, and partially anchored scene states.
