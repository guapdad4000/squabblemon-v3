# Where the game takes over

Required route: 01 → 02 → 03 → 04 → 06 → 07 → 08. Optional 05 branches after 02 and never gates another scene.

Each pre-fight clip ends with the challenge. Freeze a clean final frame, reveal the game's existing fight control/briefing, and run the real card match. Do not generate simulated cards, scores, win conditions, rewards, or combat outcomes in the movie. After server-confirmed victory, play the matching post clip. After defeat, return to retry with optional defeat dialogue. Scene 08 is ceremony only.

| Scene | Fight | Preserve |
| --- | --- | --- |
| 01 | Ganger Blue, guided | Two districts are enough to win. |
| 02 | Ganger Blue, standard | Tempo/commitment; no new narrative modifiers. |
| 03 | Ganger Red, rule twist | Existing round-two middle-district lock, both sides; existing starting Motion and lane bonus. |
| 04 | Ganger Red, standard | Existing CPU starting Motion and round-four pressure. |
| 05 | Alley Runner, optional mastery | Movement opponent; cosmetic reward; no vending-machine enemy. |
| 06 | Snitch, mini-boss | Watching the Feed: one-time +2 CPU Motion at round 4. |
| 07 | Cracked Head, boss | Existing three one-time phases; dialogue cues are optional additions. |
| 08 | No fight | Existing ceremony rewards only. |

Chapter One retains six required battles and one optional battle, 775 total street-xp from required fights, seven possible first-perfect-clear tickets plus one ceremony ticket. The scene text must not promise an unconfigured character unlock. No generated video may advance progress on its own.

Normal dialogue: 106 lines across eight scenes, including 11 on optional route; required-only route is 95. Seven optional defeat lines appear in dialogue.json; three optional boss-phase lines remain in the read-through. The game integration pass must separately handle saved dialogue IDs/content migration and keep player progress/reward claims intact.
