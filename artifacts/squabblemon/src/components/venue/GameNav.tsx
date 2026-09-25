import { Attention } from '../Notifications';
import { MusicControls } from '../MusicControls';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'wouter';
import { X } from 'lucide-react';
import { GameGlyph } from './GameGlyph';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { getAssetUrl } from '../../lib/assets';
import './fan-navigation.css';
import './cinema-nav.css';

const routes = [
  { path: '/game', label: 'Safehouse', detail: 'Home court', art: 'safehouse', primary: true, glyph: 'compass' },
  { path: '/game/story', label: 'The streets', detail: 'Story mode', art: 'streets', primary: true, glyph: 'map' },
  { path: '/game/collection', label: 'Cards & gangs', detail: 'Collection and decks', art: 'collection', primary: false, glyph: 'layers' },
  { path: '/game/online', label: 'Fight', detail: 'Fade Park & friend fades', art: 'fight', primary: true, glyph: 'crossed' },
  { path: '/game/shop', label: 'Shop', detail: 'Train, recruit, pull', art: 'shop', primary: true, glyph: 'bag' },
] as const;

const safehouseDestinations = routes.filter(route => route.path !== '/game');

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
  return <img src={getAssetUrl(`brand/navigation-painted/ab/${name}.webp`)} alt="" draggable={false} width={512} height={512} />;
}

export function GameNav({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [location, setLocation] = useLocation();
  const pathname = pathnameFor(location);
  const [tap, setTap] = useState(0);
  const active = (path: string) => pathname === path || (path === '/game/collection' && pathname.startsWith('/game/decks')) || (path !== '/game' && pathname.startsWith(`${path}/`));
  const rewards = bootstrap.missions.filter(m => m.status === 'claimable').length;
  function navigate(path: string) {
    setTap(value => value + 1);
    setLocation(path);
  }

  function renderRay(route: typeof routes[number], index: number, count: number) {
    const selected = active(route.path);
    return <button key={route.path} type="button"
      className={`fan-nav__ray ${selected ? 'is-active' : ''}`}
      style={fanPosition(index, count)} aria-label={route.label}
      aria-current={selected ? 'page' : undefined} title={`${route.label} · ${route.detail}`}
      onClick={() => navigate(route.path)}>
      <span className="fan-nav__pose"><span key={selected ? tap : 'rest'} className="fan-nav__object"><NavArt name={route.art} /></span></span>
      <span className="fan-nav__label">{route.label}<Attention section={route.art === 'collection' ? 'cards' : route.art} /></span>
    </button>;
  }

  if (pathname !== '/game') {
    return <CinemaNavSheet location={location} navigate={navigate} rewards={rewards} />;
  }

  return <>
    <nav className="fan-nav" aria-label="Game navigation" style={{ '--fan-count': safehouseDestinations.length } as CSSProperties}>
      <div className="fan-nav__spread fan-nav__spread--desktop">{safehouseDestinations.map((route, index) => renderRay(route, index, safehouseDestinations.length))}</div>
      <div className="fan-nav__spread fan-nav__spread--compact">{safehouseDestinations.map((route, index) => renderRay(route, index, safehouseDestinations.length))}</div>
    </nav>
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
  const [battleNavigationSlot, setBattleNavigationSlot] = useState<HTMLElement | null>(null);
  const pathname = pathnameFor(location);
  const active = (path: string) => pathname === path || (path === '/game/collection' && pathname.startsWith('/game/decks')) || (path !== '/game' && pathname.startsWith(`${path}/`));

  useEffect(() => {
    sheetRef.current?.close();
    setOpen(false);
  }, [location]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const sync = () => {
      const suppressed = syncCinemaNavWithStoryOverlay(sheetRef.current, document);
      const slot = document.querySelector<HTMLElement>('[data-battle-navigation-slot]');
      setBattleNavigationSlot(previous => previous === slot ? previous : slot);
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

  const trigger = <button
      type="button"
      className={`cinema-nav-toggle city-line-toggle express-toggle${battleNavigationSlot ? ' express-toggle--battle' : ''}`}
      aria-label="Open game navigation"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="cinema-nav-sheet"
      onClick={toggle}
    >
      <img src={getAssetUrl('brand/navigation/squabble-express.png')} width={1254} height={1254} alt="" draggable={false} />
      <span>Express</span>
    </button>;
  return <>
    {battleNavigationSlot ? createPortal(trigger, battleNavigationSlot) : trigger}
    <dialog
      id="cinema-nav-sheet"
      ref={sheetRef}
      className="cinema-nav-sheet express-sheet"
      aria-labelledby="cinema-nav-title"
      onClose={() => setOpen(false)}
      onClick={event => { if (event.target === sheetRef.current) sheetRef.current?.close(); }}
    >
      <h2 id="cinema-nav-title" className="sr-only">Squabble Express</h2>
      <button type="button" className="express-close" aria-label="Close game navigation" onClick={() => sheetRef.current?.close()}>
        <X size={21} aria-hidden="true" />
      </button>
      <div className="express-board">
        <img className="express-board__art" src={getAssetUrl('brand/navigation/squabble-express-map.png')}
          width={1122} height={1402} alt="" draggable={false} />
        <nav className="express-map" aria-label="Game destinations">
          <p className="express-map__heading">Pick your stop</p>
          <svg className="express-map__streets" viewBox="0 0 400 440" preserveAspectRatio="none" aria-hidden="true">
            <g fill="#7c8b7040" stroke="#67775c55" strokeWidth="1">
              <path d="M8 8h105v66H8z M291 8h96v66h-96z M8 117h69v73H8z M315 117h72v73h-72z M9 240h75v78H9z M301 240h87v78h-87z M9 365h90v61H9z M299 365h90v61h-90z" />
              <path d="M145 12h90v66h-90z M140 127h114v65H140z M145 247h100v60H145z M144 361h96v68h-96z" fill="#ac986329" />
            </g>
            <path d="M-10 97H410 M-10 219H410 M-10 341H410 M126-10V460 M276-10V460" fill="none" stroke="#86734d30" strokeWidth="18" />
            <path d="M-10 97H410 M-10 219H410 M-10 341H410 M126-10V460 M276-10V460" fill="none" stroke="#f4e6c177" strokeWidth="2" strokeDasharray="7 7" />
            <path d="M82 53H306V164H95V281H303V398H94" fill="none" stroke="#99642e80" strokeWidth="3" strokeDasharray="3 7" strokeLinecap="round" />
          </svg>
          <div className="express-map__stops">
            {routes.map((route, index) => {
              const selected = active(route.path);
              return <button key={route.path} type="button"
                className={`express-sign ${index % 2 ? 'express-sign--right' : 'express-sign--left'} ${selected ? 'is-active' : ''}`}
                aria-label={`${route.label} · ${route.detail}`} aria-current={selected ? 'page' : undefined}
                title={`${route.label} · ${route.detail}`} onClick={() => choose(route.path)}>
                <span className="express-sign__post" aria-hidden="true" />
                <span className="express-sign__board"><span className="express-sign__bolt" aria-hidden="true" /><strong>{route.label}<Attention section={route.art === 'collection' ? 'cards' : route.art} /></strong><span className="express-sign__arrow" aria-hidden="true">{index % 2 ? '›' : '‹'}</span></span>
                {selected && <span className="express-sign__here">You are here</span>}
              </button>;
            })}
          </div>
        </nav>
      </div>
      <div className="express-audio"><MusicControls compact /></div>
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
