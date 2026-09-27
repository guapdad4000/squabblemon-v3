import { lazy } from 'react';

// Keep these imports dynamic: signing in must not download every game screen.
const loaders = {
  Home: () => import('./Home').then(m => ({ default: m.Home })),
  Events: () => import('./Events').then(m => ({ default: m.Events })),
  Inventory: () => import('./Inventory').then(m => ({ default: m.Inventory })),
  CharacterStyles: () => import('./CharacterStyles').then(m => ({ default: m.CharacterStyles })),
  CharacterCollections: () => import('./CharacterCollections').then(m => ({ default: m.CharacterCollections })),
  Collection: () => import('./Collection').then(m => ({ default: m.Collection })),
  DeckEditor: () => import('./DeckEditor').then(m => ({ default: m.DeckEditor })),
  Decks: () => import('./Decks').then(m => ({ default: m.Decks })),
  DeckTest: () => import('./DeckTest').then(m => ({ default: m.DeckTest })),
  PlayerDeckPlay: () => import('./PlayerDeckPlay').then(m => ({ default: m.PlayerDeckPlay })),
  Missions: () => import('./Missions').then(m => ({ default: m.Missions })),
  Onboarding: () => import('./Onboarding').then(m => ({ default: m.Onboarding })),
  Settings: () => import('./Settings').then(m => ({ default: m.Settings })),
  Shop: () => import('./Shop').then(m => ({ default: m.Shop })),
  Story: () => import('./Story').then(m => ({ default: m.Story })),
  Multiplayer: () => import('./Multiplayer').then(m => ({ default: m.Multiplayer })),
  ChallengesHub: () => import('./ChallengesHub').then(m => ({ default: m.ChallengesHub })),
};

export const Home = lazy(loaders.Home);
export const Events = lazy(loaders.Events);
export const Inventory = lazy(loaders.Inventory);
export const CharacterStyles = lazy(loaders.CharacterStyles);
export const CharacterCollections = lazy(loaders.CharacterCollections);
export const Collection = lazy(loaders.Collection);
export const DeckEditor = lazy(loaders.DeckEditor);
export const Decks = lazy(loaders.Decks);
export const DeckTest = lazy(loaders.DeckTest);
export const PlayerDeckPlay = lazy(loaders.PlayerDeckPlay);
export const Missions = lazy(loaders.Missions);
export const Onboarding = lazy(loaders.Onboarding);
export const Settings = lazy(loaders.Settings);
export const Shop = lazy(loaders.Shop);
export const Story = lazy(loaders.Story);
export const Multiplayer = lazy(loaders.Multiplayer);
export const ChallengesHub = lazy(loaders.ChallengesHub);

export function gameRouteKey(path: string): keyof typeof loaders | undefined {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  if (pathname === '/game') return 'Home';
  if (pathname === '/game/events') return 'Events';
  if (pathname === '/game/onboarding') return 'Onboarding';
  if (/^\/game\/(training|challenges|play)$/.test(pathname)) return 'ChallengesHub';
  if (/^\/game\/online(?:\/[^/]+)?$/.test(pathname)) return 'Multiplayer';
  if (/^\/game\/story\/play\/[^/]+$/.test(pathname)) return 'PlayerDeckPlay';
  if (/^\/game\/decks\/[^/]+\/test$/.test(pathname)) return 'DeckTest';
  if (/^\/game\/decks\/[^/]+$/.test(pathname)) return 'DeckEditor';
  if (/^\/game\/style\/[^/]+$/.test(pathname)) return 'CharacterStyles';
  const exactRoutes: Record<string, keyof typeof loaders> = {
    '/game/inventory': 'Inventory', '/game/style': 'CharacterCollections',
    '/game/collection': 'Collection', '/game/decks': 'Decks',
    '/game/missions': 'Missions', '/game/shop': 'Shop',
    '/game/settings': 'Settings', '/game/story': 'Story',
    '/game/events': 'Events',
  };
  return exactRoutes[pathname];
}

/** Import only the intended destination. Failed speculation must remain retryable. */
const warming = new Set<keyof typeof loaders>();
export function preloadGameRoute(path: string) {
  const key = gameRouteKey(path);
  if (!key || warming.has(key)) return;
  warming.add(key);
  void loaders[key]().catch(() => { warming.delete(key); });
}

/** After the game shell is up, quietly warm every screen so later taps never wait on a download. */
export function preloadAllGameRoutes() {
  const keys = Object.keys(loaders) as (keyof typeof loaders)[];
  let index = 0;
  const idle = (cb: () => void) => { if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 2000 }); else setTimeout(cb, 200); };
  const next = () => {
    const key = keys[index++];
    if (!key) return;
    if (!warming.has(key)) { warming.add(key); void loaders[key]().catch(() => { warming.delete(key); }); }
    idle(next);
  };
  idle(next);
}
