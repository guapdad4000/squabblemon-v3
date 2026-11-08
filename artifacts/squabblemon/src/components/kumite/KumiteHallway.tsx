import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { isBreakthroughPublicEntryEnabled } from '@workspace/squabblemon-engine/breakthroughRelease';
import { getAssetUrl } from '../../data';
import type { KumiteCurrent } from '../../lib/kumite';
import { hallwayArt } from './hallwayArt';
import { startFlyerWipe } from './FlyerWipe';
import { BreakthroughPoster } from './BreakthroughPoster';
import './hallway.css';

type Props = {
  current?: KumiteCurrent;
  clock: { label: string; value: string };
  offline: boolean;
  reducedMotion: boolean;
  onEnter(): void;
  onRoad(): void;
  onHistory(): void;
};
export function KumiteHallway({ current, clock, offline, reducedMotion: preferredMotion, onEnter, onRoad, onHistory }: Props) {
  const [osMotion, setOsMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setOsMotion(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const reducedMotion = preferredMotion || osMotion;
  const [, navigate] = useLocation();
  const [leaving, setLeaving] = useState(false);
  const [posterPaused, setPosterPaused] = useState(false);
  const transition = useRef<ReturnType<typeof startFlyerWipe> | null>(null);
  useEffect(() => () => transition.current?.cancelIfPending(), []);
  const enterBreakthrough = () => {
    if (!transition.current) transition.current = startFlyerWipe(() => navigate('/game/kumite/breakthrough'), reducedMotion);
  };
  const tournament = current?.tournament;
  return <section className="km-hall" aria-label="Kumite mode select" data-reduced-motion={reducedMotion}>
    <h1 className="sr-only">Kumite</h1>
    <div className="km-hall__rigging">
      <div className="km-hall__clock" aria-label="Next Kumite tournament countdown">
        <img src={hallwayArt.clock} alt="" draggable={false} />
        <div><small>{clock.label}</small><strong>{offline ? 'OFFLINE' : clock.value}</strong></div>
      </div>
      <div className="km-hall__records" aria-label="Your Kumite record">
        {[
          ['WINS', current ? current.progression?.matchWins ?? 0 : '—'],
          ['TITLES', current ? current.progression?.championships ?? 0 : '—'],
          ['FIGHTERS', current ? `${current.progression?.rewards.filter(r => r.claimed || r.owned).length ?? 0}/9` : '—'],
        ].map(([label, value]) => <div className="km-hall__pennant" key={label}>
          <img src={hallwayArt.banner} alt="" draggable={false} /><span><b>{value}</b><small>{label}</small></span>
        </div>)}
      </div>
    </div>
    <div className="km-hall__wall" inert={leaving}>
      <div className="km-hall__feature" data-leaving={leaving}>
        <Link href="/game/kumite/breakthrough" className="km-hall__main-flyer" aria-label="Find opponent — Breakthrough" aria-disabled={!isBreakthroughPublicEntryEnabled() || leaving}
          onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (isBreakthroughPublicEntryEnabled() && !leaving) setLeaving(true); }}>
          <BreakthroughPoster paused={posterPaused} leaving={leaving} reducedMotion={reducedMotion} onComplete={enterBreakthrough} />
          {!isBreakthroughPublicEntryEnabled() && <span className="km-hall__ticket">PVP IN PREPARATION</span>}
        </Link>
        {!reducedMotion && !leaving && <button type="button" className="km-poster__pause" aria-label={posterPaused ? 'Play poster animation' : 'Pause poster animation'} onClick={() => setPosterPaused(value => !value)}>{posterPaused ? 'PLAY' : 'PAUSE'}</button>}
      </div>
      <button className="km-wall-flyer km-wall-flyer--weekly" type="button" onClick={onEnter} aria-label="Enter Kumite">
        <img className="km-wall-flyer__paper" src={hallwayArt.paper} alt="" draggable={false} />
        <span className="km-wall-flyer__content"><small>{tournament?.status === 'active' ? 'FIGHTS LIVE NOW' : tournament ? `${tournament.entrants.length}/${tournament.capacity} LOCKED` : 'WEEKLY PVP'}</small>
          <strong>WEEKLY<br />BRACKET</strong><img className="km-wall-flyer__art" src={getAssetUrl('assets/kumite/films/v1/unlock-chonk-landscape.webp')} alt="" draggable={false} />
          <span className="km-wall-flyer__action">ENTER KUMITE ↗</span></span>
      </button>
      <Link className="km-wall-flyer km-wall-flyer--raid" href="/game/challenges?game=punch-on-patrol&raid=kumite" aria-label="Play Dojo Boss Raid">
        <img className="km-wall-flyer__paper" src={hallwayArt.paper} alt="" draggable={false} />
        <span className="km-wall-flyer__content"><small>5 GRANDMASTERS</small><strong>DOJO<br />BOSS RAID</strong>
          <img className="km-wall-flyer__art" src={getAssetUrl('assets/kumite/films/v1/unlock-shonuff-landscape.webp')} alt="" draggable={false} /><span className="km-wall-flyer__action">TAKE THEM ON ↗</span></span>
      </Link>
      <Link className="km-wall-flyer km-wall-flyer--story" href="/game/story?season=special-kumite-break-the-bracket" aria-label="Play Break the Bracket">
        <img className="km-wall-flyer__paper" src={hallwayArt.paper} alt="" draggable={false} />
        <span className="km-wall-flyer__content"><small>8 STORY EPISODES</small><strong>BREAK THE<br />BRACKET</strong>
          <img className="km-wall-flyer__art" src={getAssetUrl('assets/kumite/films/v1/unlock-glo-landscape.webp')} alt="" draggable={false} /><span className="km-wall-flyer__action">FIND THE GLO ↗</span></span>
      </Link>
      <div className="km-wall-flyer km-wall-flyer--road">
        <img className="km-wall-flyer__paper" src={hallwayArt.paper} alt="" draggable={false} />
        <div className="km-wall-flyer__content"><small>UNLOCK ROAD & FILMS</small><strong>LEAVE YOUR<br />MARK.</strong>
          <img className="km-wall-flyer__art" src={getAssetUrl('assets/kumite/films/v1/unlock-ptang-landscape.webp')} alt="" draggable={false} />
          <button type="button" className="km-wall-flyer__action" onClick={onRoad}>OPEN UNLOCK ROAD ↗</button>
          <button type="button" className="km-wall-flyer__archive" onClick={onHistory}>Hall of Champions →</button></div>
      </div>
    </div>
    <img className="km-hall__sign" src={hallwayArt.sign} alt="Kumite" draggable={false} />
  </section>;
}
