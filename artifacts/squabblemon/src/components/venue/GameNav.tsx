import { MusicControls } from '../MusicControls';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { X, Compass, Map, Layers, Swords, Users, ScrollText, ShoppingBag, Wallet, Menu } from 'lucide-react';
import { GameGlyph } from './GameGlyph';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { getAssetUrl } from '../../lib/assets';
import './fan-navigation.css';
import './cinema-nav.css';

const routes = [
  { path: '/game', label: 'Safehouse', detail: 'Home court', art: 'safehouse', primary: true, glyph: 'compass' },
  { path: '/game/story', label: 'The streets', detail: 'Story mode', art: 'streets', primary: true, glyph: 'map' },
  { path: '/game/collection', label: 'Collection', detail: 'Your arsenal', art: 'collection', primary: false, glyph: 'layers' },
  { path: '/game/online', label: 'Fight', detail: 'Challenge a friend', art: 'fight', primary: true, glyph: 'crossed' },
  { path: '/game/decks', label: 'Your gang', detail: 'Build a lineup', art: 'crew', primary: false, glyph: 'users' },
  { path: '/game/missions', label: 'Bounties', detail: 'Work the city', art: 'bounties', primary: false, glyph: 'scroll' },
  { path: '/game/shop', label: 'Shop', detail: 'Train, recruit, pull', art: 'shop', primary: true, glyph: 'bag' },
  { path: '/game/settings', label: 'Profile', detail: 'Make it yours', art: 'profile', primary: false, glyph: 'wallet' },
] as const;

const Glyph = ({ name }: { name: typeof routes[number]['glyph'] }): ReactNode => {
  const glyphs: Record<typeof routes[number]['glyph'], ReactNode> = {
    compass: <Compass size={17} />,
    map: <Map size={17} />,
    layers: <Layers size={17} />,
    crossed: <Swords size={17} />,
    users: <Users size={17} />,
    scroll: <ScrollText size={17} />,
    bag: <ShoppingBag size={17} />,
    wallet: <Wallet size={17} />,
  };
  return glyphs[name] ?? <Menu size={17} />;
};

function pathnameFor(location: string) {
  const pathname = location.split(/[?#]/, 1)[0] || '/game';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

type CinemaNavDialog = { readonly open: boolean; close: () => void };
type CinemaNavQueryRoot = { querySelector: (selector: string) => Element | null };

export function syncCinemaNavWithStoryOverlay(
  sheet: CinemaNavDialog | null,
  root: CinemaNavQueryRoot | null,
): boolean {
  const suppressed = Boolean(root?.querySelector('.story-node-overlay'));
  if (suppressed && sheet?.open) sheet.close();
  return suppressed;
}

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
  const pathname = pathnameFor(location);
  const menu = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tap, setTap] = useState(0);
  const active = (path: string) => pathname === path || (path !== '/game' && pathname.startsWith(`${path}/`));
  const rewards = bootstrap.missions.filter(m => m.status === 'claimable').length;
  const secondaryActive = routes.find(route => !route.primary && active(route.path));

  useEffect(() => {
    menu.current?.close();
    setMenuOpen(false);
  }, [location]);

  function navigate(path: string) {
    menu.current?.close();
    setMenuOpen(false);
    setTap(value => value + 1);
    setLocation(path);
  }

  function openMenu() {
    menu.current?.showModal();
    setMenuOpen(true);
  }

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

  if (pathname !== '/game') {
    return <CinemaNavSheet location={location} navigate={navigate} rewards={rewards} />;
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

/** A small route menu for every game section outside the Safehouse. */
export function CinemaNavSheet({
  location,
  navigate,
  rewards,
}: {
  location: string;
  navigate: (path: string) => void;
  rewards: number;
}) {
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [storyOverlayPresent, setStoryOverlayPresent] = useState(false);
  const pathname = pathnameFor(location);
  const active = (path: string) => pathname === path || (path !== '/game' && pathname.startsWith(`${path}/`));

  useEffect(() => {
    sheetRef.current?.close();
    setOpen(false);
  }, [location]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const sync = () => {
      const suppressed = syncCinemaNavWithStoryOverlay(sheetRef.current, document);
      setStoryOverlayPresent(previous => previous === suppressed ? previous : suppressed);
      if (suppressed) setOpen(false);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (sheet.open) sheet.close();
    else {
      sheet.showModal();
      setOpen(true);
    }
  }

  function choose(path: string) {
    sheetRef.current?.close();
    setOpen(false);
    navigate(path);
  }

  if (storyOverlayPresent) return null;

  return <>
    <button
      type="button"
      className="cinema-nav-toggle"
      aria-label="Open game navigation"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="cinema-nav-sheet"
      onClick={toggle}
    >
      <span className="cinema-nav-toggle__dot" aria-hidden="true" />
      <span>Menu</span>
    </button>
    <dialog
      id="cinema-nav-sheet"
      ref={sheetRef}
      className="cinema-nav-sheet"
      aria-labelledby="cinema-nav-title"
      onClose={() => setOpen(false)}
      onClick={event => { if (event.target === sheetRef.current) sheetRef.current?.close(); }}
    >
      <header className="cinema-nav-sheet__header">
        <div>
          <small>Reverse 1991 · Director's Cut</small>
          <h2 id="cinema-nav-title">Pick your scene</h2>
        </div>
        <button type="button" className="cinema-nav-sheet__close" aria-label="Close game navigation" onClick={() => sheetRef.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <nav className="cinema-nav-sheet__grid" aria-label="Game destinations">
        {routes.map(route => {
          const selected = active(route.path);
          return (
            <button
              key={route.path}
              type="button"
              className={`cinema-nav-sheet__choice ${selected ? 'is-active' : ''}`}
              aria-current={selected ? 'page' : undefined}
              onClick={() => choose(route.path)}
            >
              <span className="cinema-nav-sheet__choice__glyph"><Glyph name={route.glyph} /></span>
              <span className="cinema-nav-sheet__choice__copy">
                <strong>{route.label}</strong>
                <small>{route.detail}</small>
              </span>
              {route.art === 'bounties' && rewards > 0 && (
                <span className="cinema-nav-sheet__badge" aria-label={`${rewards} rewards ready`}>{rewards}</span>
              )}
            </button>
          );
        })}
      </nav>
      <footer className="cinema-nav-sheet__footer">
        <span>Squabblemon · 1991</span>
        <div className="music-controls-row"><MusicControls compact /></div>
      </footer>
    </dialog>
  </>;
}

export function GameHud({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  return <header className="venue-hud">
    <Link href="/game/settings" className="venue-hud__identity"><span className="venue-hud__level">{profile.level.toString().padStart(2, '0')}</span><span><small>YOUR REPUTATION STARTS HERE</small><strong>{profile.displayName}</strong></span></Link>
    <div className="venue-hud__wallet" aria-label="Player balances">
      <span title="Street reputation"><GameGlyph name="rep" /><b>{profile.streetRep.toLocaleString()}</b><small>REP</small></span>
      <Link href="/game/shop?view=training" title="Spend Clout at the Trading Post"><GameGlyph name="clout" /><b>{profile.softCurrency.toLocaleString()}</b><small>CLOUT</small></Link>
      <Link href="/game/shop?view=packs" title="Pack tickets"><GameGlyph name="ticket" /><b>{profile.packTickets.toLocaleString()}</b><small>TICKETS</small></Link>
    </div>
    <MusicControls compact />
    {profile.id === 'e2e-player' && <span className="venue-hud__preview">LOCAL PREVIEW</span>}
  </header>;
}
