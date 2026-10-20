import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StoryCinematic } from '@workspace/squabblemon-engine/story';
import { getAssetUrl } from '../../../data';
import { setMusicDucked } from '../../../musicStore';
import { useStoryModalFocus } from './useStoryModalFocus';
import '../../../styles/squabble-house.css';

export function StoryMovie({ cinematic, title, onContinue, onClose }: {
  cinematic: StoryCinematic; title: string; onContinue: () => void; onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  useStoryModalFocus(host);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); setMusicDucked(false); };
  }, [onClose]);
  const play = async () => {
    setStarted(true); setPlayBlocked(false);
    try { await video.current?.play(); } catch { setPlayBlocked(true); }
  };
  return createPortal(
    <div className="house-movie" ref={host} role="dialog" aria-modal="true" aria-labelledby="house-movie-title" data-testid="story-movie">
      <header><div><span>Squabble House · The Last Waffle</span><h2 id="house-movie-title">{title}</h2></div><button onClick={onClose} type="button">Back to map</button></header>
      <div className="house-movie__screen">
        <video ref={video} src={getAssetUrl(cinematic.videoAssetId)} poster={getAssetUrl(cinematic.posterAssetId)}
          controls={started && !failed} playsInline preload="metadata" aria-label={`${title} cinematic`}
          onPlay={() => setMusicDucked(true)} onPause={() => setMusicDucked(false)} onEnded={onContinue}
          onError={() => { setFailed(true); setMusicDucked(false); }} />
        {(!started || playBlocked || failed) && <div className="house-movie__start">
          <span className="house-movie__reel">A SQUABBLEMON SHORT</span>
          {failed ? <p role="status">The movie couldn’t load. Continue into the illustrated scene, or reopen this chapter to retry.</p>
            : <button className="house-movie__play" type="button" onClick={() => void play()}>{playBlocked ? 'Resume chapter' : '▶ Play chapter'}</button>}
          {!failed && <p>Sound on · 10 seconds · Player controls available</p>}
        </div>}
      </div>
      <footer><p>Movie → Dialogue → Puzzle → Battle → Reward</p><button type="button" onClick={onContinue}>Continue to dialogue →</button></footer>
    </div>, document.body,
  );
}
