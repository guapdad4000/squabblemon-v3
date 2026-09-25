import { NotificationInbox } from '../Notifications';
import { Link, useLocation } from 'wouter';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { GameBackButton } from './GameBackButton';
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
  return <header className="city-header" aria-label="Player and navigation">
    {!isSafehouse && <GameBackButton />}
    <Link href="/game/settings" className="city-header__identity"><span className="city-header__level" aria-label={'Level ' + profile.level}>{profile.level}</span><span><strong>{profile.displayName}</strong><small>LEVEL {profile.level} · {profile.streetRep.toLocaleString()} REP</small></span></Link>
    <div className="city-header__wallet">
      <Link href="/game/shop?view=corner" className="city-header__balance" title={profile.softCurrency.toLocaleString() + ' Clout'} aria-label={profile.softCurrency + ' Clout. Open Fade Market'}><GameGlyph name="clout" /><b>{profile.softCurrency.toLocaleString()}</b></Link>
      <Link href="/game/style" className="city-header__balance city-header__shards" title={(profile.styleShards ?? 0).toLocaleString() + ' Style Shards'} aria-label={(profile.styleShards ?? 0) + ' Style Shards. Open character styles'}><GameGlyph name="shards" /><b>{(profile.styleShards ?? 0).toLocaleString()}</b></Link>
    </div>
    <NotificationInbox />
    <MusicControls compact variant="dj" className="city-header__music" wrapperClassName="city-header__dj" />
    <CinemaNavSheet location={location} navigate={navigate} rewards={bootstrap.missions.filter(m => m.status === 'claimable').length} />
  </header>;
}
