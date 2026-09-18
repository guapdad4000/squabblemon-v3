import { MusicControls } from '../MusicControls';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'wouter';
import { Crown, Ticket, X, Coins } from 'lucide-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { getAssetUrl } from '../../lib/assets';
import './fan-navigation.css';

const routes = [
  { path: '/game', label: 'Safehouse', detail: 'Home court', art: 'safehouse', primary: true, glyph: 'compass' },
  { path: '/game/story', label: 'The streets', detail: 'Story mode', art: 'streets', primary: true, glyph: 'map' },
  { path: '/game/collection', label: 'Collection', detail: 'Your arsenal', art: 'collection', primary: false, glyph: 'layers' },
  { path: '/game/online', label: 'Fight', detail: 'Challenge a friend', art: 'fight', primary: true, glyph: 'crossed' },
  { path: '/game/decks', label: 'Your crew', detail: 'Build a lineup', art: 'crew', primary: false, glyph: 'users' },
  { path: '/game/missions', label: 'Bounties', detail: 'Work the city', art: 'bounties', primary: false, glyph: 'scroll' },
  { path: '/game/shop', label: 'Shop', detail: 'Train, recruit, pull', art: 'shop', primary: true, glyph: 'bag' },
  { path: '/game/settings', label: 'Profile', detail: 'Make it yours', art: 'profile', primary: false, glyph: 'wallet' },
] as const;

function fanPosition(index: number, count: number): CSSProperties {
  const offset = index - (count - 1) / 2;
  return {
    '--ray-angle': `${offset * 8}deg`,
    '--ray-drop': `${Math.pow(Math.abs(offset), 1.65) * 3}px`,
    '--ray-nudge': `${offset * (count > 5 ? -12 : -6)}px`,
    '--ray-order': count - Math.round(Math.abs(offset)),
  } as CSSProperties;
}

function NavArt({ name }: { name: typeof routes[number]['art'] }) {
  return <img src={getAssetUrl(`brand/navigation-painted/${name}.webp`)} alt="" draggable={false} width={512} height={512} />;
}

export function GameNav({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [location, setLocation] = useLocation();
  const menu = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tap, setTap] = useState(0);
  const active = (path: string) => location === path || (path !== '/game' && location.startsWith(`${path}/`));
  const rewards = bootstrap.missions.filter(m => m.status === 'claimable').length;
  const secondaryActive = routes.find(route => !route.primary && active(route.path));
  useEffect(() => { menu.current?.close(); setMenuOpen(false); }, [location]);
  function navigate(path: string) {
    menu.current?.close();
    setMenuOpen(false);
    setTap(value => value + 1);
    setLocation(path);
  }
  function openMenu() { menu.current?.showModal(); setMenuOpen(true); }
  function renderRay(route: typeof routes[number], index: number, count: number) {
    const selected = active(route.path);
    return <button key={route.path} type="button"
      className={`fan-nav__ray ${selected ? 'is-active' : ''}`}
      style={fanPosition(index, count)} aria-label={route.label}
      aria-current={selected ? 'page' : undefined} title={`${route.label} · ${route.detail}`}
      onClick={() => navigate(route.path)}>
      <span className="fan-nav__pose"><span key={selected ? tap : 'rest'} className="fan-nav__object"><NavArt name={route.art} /></span></span>
      <span className="fan-nav__label">{route.label}</span>
      {route.art === 'bounties' && rewards > 0 && <span className="fan-nav__badge" aria-label={`${rewards} rewards ready`}>{rewards}</span>}
    </button>;
  }
  return <>
    <nav className="fan-nav" aria-label="Game navigation">
      <div className="fan-nav__spread fan-nav__spread--desktop">{routes.map((route, index) => renderRay(route, index, routes.length))}</div>
      <div className="fan-nav__spread fan-nav__spread--compact">
        {routes.filter(route => route.primary).map((route, index) => renderRay(route, index, 5))}
        <button type="button" className={`fan-nav__ray fan-nav__more ${secondaryActive || menuOpen ? 'is-active' : ''}`}
          style={fanPosition(4, 5)} aria-label="More destinations" aria-haspopup="dialog" aria-expanded={menuOpen}
          aria-controls="fan-territory-menu" onClick={openMenu}>
          <span className="fan-nav__pose"><span className="fan-nav__object"><NavArt name={secondaryActive?.art ?? 'profile'} /></span></span>
          <span className="fan-nav__label">{secondaryActive?.label ?? 'More'}</span>
          {rewards > 0 && <span className="fan-nav__badge" aria-label={`${rewards} rewards ready`}>{rewards}</span>}
        </button>
      </div>
    </nav>
    <dialog id="fan-territory-menu" className="fan-menu" ref={menu} aria-labelledby="fan-menu-title"
      onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === menu.current) menu.current.close(); }}>
      <header className="fan-menu__header"><div><span className="venue-kicker">KNOW YOUR CITY</span><h2 id="fan-menu-title">Your territory</h2></div>
        <button className="venue-icon-button" aria-label="Close menu" onClick={() => menu.current?.close()}><X size={20} /></button></header>
      <div className="px-5 pb-3"><MusicControls /></div>
      <div className="fan-menu__objects">{routes.filter(route => !route.primary).map(route =>
        <button key={route.path} type="button" className={`fan-menu__choice ${active(route.path) ? 'is-active' : ''}`}
          aria-current={active(route.path) ? 'page' : undefined} onClick={() => navigate(route.path)}>
          <NavArt name={route.art} /><strong>{route.label}</strong><small>{route.detail}</small>
          {route.art === 'bounties' && rewards > 0 && <span className="fan-menu__reward">{rewards} ready to claim</span>}
        </button>)}</div>
    </dialog>
  </>;
}

export function GameHud({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  return <header className="venue-hud">
    <Link href="/game/settings" className="venue-hud__identity"><span className="venue-hud__level">{profile.level.toString().padStart(2, '0')}</span><span><small>YOUR REPUTATION STARTS HERE</small><strong>{profile.displayName}</strong></span></Link>
    <div className="venue-hud__wallet" aria-label="Player balances">
      <span title="Street reputation"><Crown size={16} /><b>{profile.streetRep.toLocaleString()}</b><small>REP</small></span>
      <Link href="/game/shop?view=training" title="Spend Clout at the Trading Post"><Coins size={16} /><b>{profile.softCurrency.toLocaleString()}</b><small>CLOUT</small></Link>
      <Link href="/game/shop?view=packs" title="Pack tickets"><Ticket size={16} /><b>{profile.packTickets.toLocaleString()}</b><small>TICKETS</small></Link>
    </div>
    <MusicControls compact />
    {profile.id === 'e2e-player' && <span className="venue-hud__preview">LOCAL PREVIEW</span>}
  </header>;
}