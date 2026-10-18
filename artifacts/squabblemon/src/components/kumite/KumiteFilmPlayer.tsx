import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAssetUrl } from '../../lib/assets';
import { cardMotionReduced } from '../../lib/cardFinish';
import { kumiteFilmAsset, ownedKumiteFilms, type KumiteFilm } from '../../lib/kumiteFilms';
import { setMusicDucked } from '../../musicStore';
import '../../styles/kumite-films.css';

export function KumiteFilmPlayer({ film, onClose, onComplete }: { film: KumiteFilm; onClose: () => void; onComplete?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const titleId = useId();
  // Lock the edit for this viewing; a rotation must not restart a playing film.
  const [portrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);
  const [reduced] = useState(cardMotionReduced);
  const [failed, setFailed] = useState(false);
  const [needsPlay, setNeedsPlay] = useState(reduced);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = dialog.current;
    const player = video.current;
    modal?.showModal();
    if (!reduced) player?.play().catch(() => setNeedsPlay(true));
    const pauseHidden = () => { if (document.hidden) player?.pause(); };
    document.addEventListener('visibilitychange', pauseHidden);
    return () => {
      document.removeEventListener('visibilitychange', pauseHidden);
      player?.pause();
      setMusicDucked(false);
      modal?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [reduced]);
  function replay() {
    if (!video.current) return;
    video.current.currentTime = 0;
    video.current.play().catch(() => setNeedsPlay(true));
  }
  return createPortal(<dialog ref={dialog} className="kumite-film" aria-labelledby={titleId}
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <header className="kumite-film__toolbar"><h2 id={titleId}>{film.name}</h2><button type="button" autoFocus onClick={onClose}>Skip / close</button></header>
    <div className="kumite-film__screen">
      <video ref={video} playsInline controls preload="none" aria-label={`${film.name} Kumite film`} aria-describedby={`${titleId}-description`}
        src={getAssetUrl(kumiteFilmAsset(film, portrait))} poster={getAssetUrl(kumiteFilmAsset(film, portrait, true))}
        onPlay={() => { setNeedsPlay(false); setMusicDucked(true); }}
        onPause={() => setMusicDucked(false)} onEnded={() => { setMusicDucked(false); onComplete?.(); }}
        onError={() => { setFailed(true); setMusicDucked(false); onComplete?.(); }} />
      {failed ? <p role="alert">Film unavailable. You can close this and keep playing.</p> : null}
    </div>
    <footer className="kumite-film__toolbar"><p id={`${titleId}-description`} className="kumite-film__description">{film.description}</p>
      {!failed ? <button type="button" onClick={replay}>{needsPlay ? 'Play film' : 'Replay'}</button> : null}
    </footer>
  </dialog>, document.body);
}

/** Mount no player or media request until an owned fighter's button is pressed. */
export function KumiteFilmReplay({ cardId, ownedCardIds }: { cardId: string; ownedCardIds: readonly string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const films = ownedKumiteFilms(cardId, ownedCardIds);
  const active = films.find(film => film.key === selected);
  if (!films.length) return null;
  return <div className="kumite-film-replays">
    {films.map(film => <button key={film.key} type="button" onClick={() => setSelected(film.key)} aria-label={`Watch ${film.name} Kumite film`}><span aria-hidden="true">▶</span> {film.label}</button>)}
    {active ? <KumiteFilmPlayer key={active.key} film={active} onClose={() => setSelected(null)} /> : null}
  </div>;
}
