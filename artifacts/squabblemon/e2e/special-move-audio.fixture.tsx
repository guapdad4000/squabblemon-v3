import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SpecialMove } from '../src/components/SpecialMove';
import { moveClips } from '../src/specialMoves';
import { MusicPlayer } from '../src/musicPlayer';
import { battleSoundtrack } from '../src/musicModes';
import { getGameAudioContext } from '../src/gameAudioContext';
import { BattleFeedback } from '../src/battleFeedback';
import { getAssetUrl } from '../src/lib/assets';
import { playVoiceLine } from '../src/lib/sfx';
function Fixture() {
  const [sound, setSound] = useState(false), [visible, setVisible] = useState(true);
  const [player, setPlayer] = useState<MusicPlayer | null>(null);
  useEffect(() => {
    const audio = document.createElement('audio');
    audio.dataset.testid = 'background-music';
    document.body.appendChild(audio);
    const music = new MusicPlayer(audio, { tracks: battleSoundtrack, assetUrl: getAssetUrl,
      publish: () => {}, createContext: getGameAudioContext, sharedContext: true });
    music.setEnvironment(true, true, true);
    setPlayer(music);
    return () => { music.dispose(); audio.remove(); };
  }, []);
  const [feedback] = useState(() => new BattleFeedback({ audioEnabled: true, hapticsEnabled: false }));
  useEffect(() => () => feedback.reset(), [feedback]);
  return <main style={{ background: '#172030', color: 'white', padding: 20 }}>
    <button onClick={() => player?.unlock()}>Play music</button>
    <button onClick={() => player?.setEnabled(false)}>Pause music</button>
    <button onClick={() => player?.setVolume(0)}>Music volume zero</button>
    <button onClick={() => player?.next()}>Next track</button>
    <button onClick={() => feedback.cue('fire', false, false)}>Fire cue</button>
    <button onClick={() => playVoiceLine('squabble-a')}>SQUABBLE voice</button>
    <button onClick={() => setSound(true)}>Sound on</button>
    <button onClick={() => setSound(false)}>Mute</button>
    <button onClick={() => setVisible(false)}>Skip</button>
    {visible && <div style={{ width: 360, height: 540 }}><SpecialMove clip={moveClips.char45} audioEnabled={sound} /></div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
