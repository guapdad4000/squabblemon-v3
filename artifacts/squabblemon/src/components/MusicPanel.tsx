import { StreetSelect } from './ui/street-select';
import { Pause, Play, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { soundtrack } from '../musicPlayer';
import { musicActions, useMusic, useMusicBanks, updateMusicBank } from '../musicStore';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { setAnnouncerVolume, useAnnouncerVolume } from '../lib/battleAnnouncerVolume';
import { MotionSticker } from './MotionSticker';

export default function MusicPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const music = useMusic();
  const announcerVolume = useAnnouncerVolume();
  const banks = useMusicBanks();
  const playlist = music.playlist ?? soundtrack;
  const bossLocked = playlist[0]?.id === 'boss-fight-ost';
  const [feedback, saveFeedback] = useFeedbackPreferences();
  const track = music.track ?? soundtrack[music.trackIndex];
  const canPause = music.playing && feedback.audioEnabled;
  const status = !feedback.audioEnabled ? 'Game sound muted' : music.error ?? (music.blocked ? 'Tap play to start the music' : !music.enabled ? 'Music paused' : music.playing ? 'Now playing' : 'Ready when you are');
  const play = () => musicActions.play();
  return (
      <div className="music-panel">
        <header className="music-dj-header">
          <MotionSticker variant="fade-tapes" className="music-dialog-portrait music-dialog-portrait--motion" label="Dr. Fade at the Fade Tapes turntables" />
          <div><span className="music-eyebrow">DR. FADE PRESENTS</span><h2 id={`${id}-title`}>The Fade Tapes</h2></div>
          <button type="button" aria-label="Close music controls" onClick={onClose}><X size={20} /></button></header>
        <div className="music-now" aria-live="polite"><span>{status}</span><strong>{track.title}</strong><p>{track.album} · {track.artist}</p></div>
        <div className="music-transport">
          <button type="button" className="music-play" aria-label={canPause ? 'Pause music' : 'Play music'}
            onClick={() => { if (canPause) musicActions.pause(); else play(); }}>
            {canPause ? <Pause size={19} /> : <Play size={19} />} {canPause ? 'Pause' : 'Play'}
          </button>
          <button type="button" disabled={bossLocked} aria-label="Next track" onClick={musicActions.next}><SkipForward size={19} /> Next track</button>
          <button type="button" className="music-master" aria-label={feedback.audioEnabled ? 'Mute all game sound' : 'Enable all game sound'}
            aria-pressed={!feedback.audioEnabled}
            onClick={() => saveFeedback(value => ({ ...value, audioEnabled: !value.audioEnabled }))}>
            {feedback.audioEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
        </div>
        <label className="music-volume"><span>Music volume <b>{Math.round(music.volume * 100)}%</b></span>
          <input type="range" min="0" max="100" step="1" value={Math.round(music.volume * 100)}
            aria-label="Music volume" aria-valuetext={`${Math.round(music.volume * 100)} percent`}
            onChange={event => musicActions.volume(Number(event.target.value) / 100)} />
        </label>
        <label className="music-volume"><span>Battle announcer <b>{Math.round(announcerVolume * 100)}%</b></span>
          <input type="range" min="0" max="100" step="1" value={Math.round(announcerVolume * 100)}
            aria-label="Battle announcer volume" aria-valuetext={`${Math.round(announcerVolume * 100)} percent`}
            onChange={event => setAnnouncerVolume(Number(event.target.value) / 100)} />
        </label>
        <p className="music-note">Round and turn calls. Set to 0% to silence the announcer; your music keeps playing.</p>
        <label className="music-track"><span>On the turntable <b>{music.trackIndex + 1} / {playlist.length}</b></span>
          <StreetSelect skin="paper" disabled={bossLocked} aria-label="Choose music track" value={music.trackIndex} onValueChange={event => musicActions.select(Number(event))}>
            {playlist.map((song, index) => <option key={song.id} value={index}>{String(index + 1).padStart(2, '0')} · {song.title}</option>)}
          </StreetSelect>
        </label>
        <div className="music-banks">{(['background', 'mode'] as const).map(bank => <fieldset key={bank}>
          <legend>{bank === 'background' ? 'Background playlist' : 'Battle, story & mode music'}</legend>
          <label><input type="checkbox" checked={banks[bank].enabled} onChange={event => updateMusicBank(bank, { enabled: event.target.checked })} /> Enabled</label>
          <label className="music-volume"><span>Volume <b>{Math.round(banks[bank].volume * 100)}%</b></span><input aria-label={bank === 'background' ? 'Background playlist volume' : 'Battle, story, and mode volume'} type="range" min="0" max="100" value={Math.round(banks[bank].volume * 100)} onChange={event => updateMusicBank(bank, { volume: Number(event.target.value) / 100 })} /></label>
        </fieldset>)}</div>
        <p className="music-note">Background records play in the safehouse and menus. Ranked, story, boss, training, and gacha tracks follow your current mode. One soundtrack plays at a time; both preferences stay saved.</p>
      </div>
  );
}
