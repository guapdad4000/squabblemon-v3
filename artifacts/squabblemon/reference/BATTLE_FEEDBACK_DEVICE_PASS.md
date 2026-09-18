# Battle feedback device release pass

Run this focused pass on a current physical iPhone in Safari and a current physical Android phone in Chrome before release. Record the device, OS, browser version, date, and result beside each platform.

## Setup

- Use the normal HTTPS preview or release candidate; do not use desktop device emulation.
- Turn the phone's media volume to a comfortable middle level.
- Start with Audio and Haptics enabled in the battle controls.

## Pass criteria

1. Tap **Start**, then play a card. The first cue starts with the presented move, without a missing or delayed first sound.
2. Turn Audio off. Play and pass through a full round; no battle sound is produced. Turn it back on and confirm the next player action restores sound.
3. Compare play, move, status, power-down, and final-claim cues. They are brief and subordinate to the game; none is painfully sharp or disproportionately loud.
4. On Android, play a card, trigger a move/status effect, and finish a match. Haptics are brief and restrained. On iPhone or any unsupported device, the same actions continue normally without vibration or errors.
5. Enable the OS **Reduce Motion** setting, reload, and play a round. No haptics occur.
6. During an effect sequence, background the tab, wait two seconds, and return. No late cue or duplicate cue occurs.
7. During a rival/effect sequence, use fast-forward. Skipped effects do not emit queued cues.
8. Navigate out of battle during a sequence, wait two seconds, and start another battle. No cue from the previous battle occurs.

## Evidence

| Platform | Device / OS / browser | Date | Result | Notes or issue |
| --- | --- | --- | --- | --- |
| iOS Safari |  |  | Pending physical-device pass |  |
| Android Chrome |  |  | Pending physical-device pass |  |

For a reproducible failure, include the exact step, mute/reduced-motion state, whether the tab was ever hidden, and whether the cue was missing, late, duplicated, or too strong. Add automated coverage when the failure can be represented through audio context state, lifecycle cancellation, visibility, preference, or vibration support.