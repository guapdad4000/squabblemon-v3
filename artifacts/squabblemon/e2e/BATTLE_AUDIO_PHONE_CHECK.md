# Battle audio: physical-phone acceptance check

Browser automation checks playback state, but cannot confirm the mixed output from a phone speaker or headphones. Run this on **iOS Safari** and **Android Chrome** on physical devices (with the ringer/media volume audible). Record the browser/OS version and whether each step passed.

1. Start a guest battle, then repeat in training, story (including a boss), and an online room. Start music in the music controls. Note the selected track and its position.
2. Play a card, trigger a SQUABBLE voice and a synthesized impact, then an ability with an audible special-move clip. Listen for **music + voice + impact + video** together. The track must not restart, stop, or jump; the special must not silence the impact. If the browser blocks audible video autoplay, confirm the card effect/visual still completes without blocking the match.
3. Set **Music volume** to zero, then play another card and special. Cues and video should remain audible. Raise music volume; only the soundtrack should change.
4. Pause music and play a card and special: only music should pause. Resume and select another track: only music should start/change. Toggle **Mute all game sound** during a voice or special; all game sound must stop or mute. Re-enable it.
5. Hide the page and return: music follows the existing visibility pause/resume policy without losing its place. Finish a match: the intentional result playlist begins; returning to a battle restores its route playlist.

Automated browser overlap check (with the web workflow running):
`MUSIC_ORIGIN=http://127.0.0.1:<web-workflow-port> node artifacts/squabblemon/e2e/verify-music-overlap.mjs`