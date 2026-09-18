import { useId, useRef, useState } from 'react';
import { Music2, Pause, Play, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { soundtrack } from '../musicPlayer';
import { musicActions, useMusic } from '../musicStore';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import './music-controls.css';

export function MusicControls({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const music = useMusic();
  const [feedback, saveFeedback] = useFeedbackPreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const track = soundtrack[music.trackIndex];
  const audible = music.playing && feedback.audioEnabled && music.volume > 0;
  const canPause = music.playing && feedback.audioEnabled;
  const status = !feedback.audioEnabled ? 'Game sound muted' : music.error ?? (music.blocked ? 'Tap play to start the music' : !music.enabled ? 'Music paused' : music.playing ? 'Now playing' : 'Ready when you are');
  function play() {
    if (!feedback.audioEnabled) saveFeedback(value => ({ ...value, audioEnabled: true }));
    musicActions.play();
  }
  return <>
    <button type="button" className={`music-trigger ${compact ? 'music-trigger--compact' : ''} ${className}`}
      aria-label="Music controls" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      title={`${audible ? 'Now playing' : 'Soundtrack'}: ${track.title}`}
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      <Music2 size={17} aria-hidden="true" /><span>Music</span><i className={audible ? 'is-playing' : ''} aria-hidden="true" />
    </button>
    <dialog id={id} ref={dialog} className="music-dialog" aria-labelledby={`${id}-title`}
      onClose={() => setOpen(false)}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="music-panel">
        <header><div><span className="music-eyebrow">THE BLOCK HAS A SOUNDTRACK</span><h2 id={`${id}-title`}>Oakland Chrome<br />and Curls</h2></div>
          <button type="button" aria-label="Close music controls" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        <div className="music-now" aria-live="polite"><span>{status}</span><strong>{track.title}</strong><p>Original music by {track.artist}</p></div>
        <div className="music-transport">
          <button type="button" className="music-play" aria-label={canPause ? 'Pause music' : 'Play music'}
            onClick={() => { if (canPause) musicActions.pause(); else play(); }}>
            {canPause ? <Pause size={19} /> : <Play size={19} />} {canPause ? 'Pause' : 'Play'}
          </button>
          <button type="button" aria-label="Next track" onClick={musicActions.next}><SkipForward size={19} /> Next track</button>
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
        <label className="music-track"><span>On the turntable <b>{music.trackIndex + 1} / {soundtrack.length}</b></span>
          <select aria-label="Choose music track" value={music.trackIndex} onChange={event => musicActions.select(Number(event.target.value))}>
            {soundtrack.map((song, index) => <option key={song.id} value={index}>{String(index + 1).padStart(2, '0')} · {song.title}</option>)}
          </select>
        </label>
        <p className="music-note">All six tracks play in rotation. Your music settings stay saved on this device.</p>
      </div>
    </dialog>
  </>;
}
