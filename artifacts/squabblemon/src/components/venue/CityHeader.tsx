import { Link, useLocation } from 'wouter';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { ArrowLeft } from 'lucide-react';
import { CinemaNavSheet } from './GameNav';
import { GameGlyph } from './GameGlyph';
import { MusicControls } from '../MusicControls';
import '../../styles/ui-polish.css';
import './city-header.css';

/** One compact header for identity, wallet, return navigation, and the Express. */
export function CityHeader({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [location, navigate] = useLocation();
  const { profile } = bootstrap;
  const isSafehouse = location.replace(/\/+$/, '') === '/game';
  const destination = /\/game\/(style|decks)\//.test(location) ? location.split('/').slice(0, 3).join('/') : '/game';
  return <header className="city-header" aria-label="Player and navigation">
    {!isSafehouse && <Link href={destination} className="city-header__back" aria-label={destination === '/game' ? 'Back to Safehouse' : 'Back to collection'}><ArrowLeft size={17} /><span>{destination === '/game' ? 'Safehouse' : 'Back'}</span></Link>}
    <Link href="/game/settings" className="city-header__identity"><span className="city-header__level" aria-label={'Level ' + profile.level}>{profile.level}</span><span><strong>{profile.displayName}</strong><small>LEVEL {profile.level} · {profile.streetRep.toLocaleString()} REP</small></span></Link>
    <Link href="/game/shop?view=corner" className="city-header__balance" aria-label={profile.softCurrency + ' Clout. Open Fade Market'}><GameGlyph name="clout" /><b>{profile.softCurrency.toLocaleString()}</b></Link>
    <MusicControls compact variant="dj" className="city-header__music" wrapperClassName="city-header__dj" />
    <CinemaNavSheet location={location} navigate={navigate} rewards={bootstrap.missions.filter(m => m.status === 'claimable').length} />
  </header>;
}
