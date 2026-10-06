import { lazy, Suspense, useId, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';
import { soundtrack } from '../musicPlayer';
import { useMusic } from '../musicStore';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { getAssetUrl } from '../data';
import './music-controls.css';

const MusicPanel = lazy(() => import('./MusicPanel'));

export function MusicControls({ compact = false, variant = 'default', className = '', wrapperClassName = '', logo = false }: { compact?: boolean; variant?: 'default' | 'dj'; className?: string; wrapperClassName?: string; logo?: boolean }) {
  const music = useMusic();
  const [feedback] = useFeedbackPreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const track = music.track ?? soundtrack[music.trackIndex];
  const audible = music.playing && feedback.audioEnabled && music.volume > 0;

  const trigger = (
    <button type="button" className={`music-trigger ${compact ? 'music-trigger--compact' : ''} ${variant === 'dj' ? 'music-trigger--dj' : ''} ${logo ? 'music-trigger--logo' : ''} ${className}`}
      aria-label="Music controls" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      title={`${audible ? 'Now playing' : 'Soundtrack'}: ${track.title}`}
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      {logo ? <img className="music-trigger__logo" src={getAssetUrl('assets/brand-motion/dr-fade-tapes-still.webp')} alt="" aria-hidden="true" width={34} height={34} decoding="async" draggable={false} /> : <Music2 size={17} aria-hidden="true" />}<span>Music</span><i className={audible ? 'is-playing' : ''} aria-hidden="true" />
    </button>
  );

  return <>
    {variant === 'dj' ? (
      <div className={`music-dj-wrapper ${wrapperClassName}`}>
        <img src={getAssetUrl('assets/generated/dr-fade-dj-turntable.webp')} alt="" aria-hidden="true" className="music-dj-art" width={560} height={700} decoding="async" draggable={false} />
        {trigger}
      </div>
    ) : trigger}
    <dialog id={id} ref={dialog} className="music-dialog" aria-labelledby={`${id}-title`}
      onClose={() => setOpen(false)}
      onKeyDown={event => event.stopPropagation()}
      onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      {open && <Suspense fallback={<div className="music-panel"><h2 id={`${id}-title`}>The Fade Tapes</h2><p role="status">Loading music controls…</p></div>}>
        <MusicPanel id={id} onClose={() => dialog.current?.close()} />
      </Suspense>}
    </dialog>
  </>;
}
