import { clearAfterSignIn, useAppAuth } from '../../lib/auth';
import {
  getGetPlayerBootstrapQueryKey,
  useGetPlayerBootstrap,
} from '@workspace/api-client-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import {
  Crown,
  House,
  Images,
  MapPinned,
  Shield,
  ShoppingBag,
  Swords,
  Ticket,
  UsersRound,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';

import { PlayLoop } from '../../components/PlayLoop';
import { starterRecipes, validateSavedDeck } from '../../data';
import { Collection } from './Collection';
import { DeckEditor } from './DeckEditor';
import { Decks } from './Decks';
import { DeckTest } from './DeckTest';
import { Home } from './Home';
import { Missions } from './Missions';
import { Onboarding } from './Onboarding';
import { Settings } from './Settings';
import { Shop } from './Shop';
import { Story } from './Story';

function LoadingScreen() {
  return (
    <div className="brand-loader" role="status" aria-label="Loading Squabblemon">
      <div className="brand-loader__halo" aria-hidden="true" />
      <img
        src={`${import.meta.env.BASE_URL}brand/squabblemon-crest.webp`}
        alt=""
        width="374"
        height="384"
        className="brand-loader__crest"
      />
      <div className="brand-loader__meter" aria-hidden="true"><span /></div>
      <span className="brand-loader__label">Loading the block</span>
    </div>
  );
}

type NavBadge = {
  label: string;
  tone: 'new' | 'reward' | 'notice';
};

type NavLink = {
  path: string;
  label: string;
  icon: typeof House;
  badge?: NavBadge;
};

function FightNightNav({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [location, setLocation] = useLocation();
  const rewardCount = bootstrap.missions.filter((mission) => mission.status === 'claimable').length;
  const collectionRewardCount = bootstrap.collectionRoad.filter((milestone) => milestone.status === 'claimable').length;
  const links: NavLink[] = [
    { path: '/game', label: 'Corner', icon: House },
    { path: '/game/story', label: 'Streets', icon: MapPinned, badge: bootstrap.nextAction.destination === 'story' ? { label: 'New', tone: 'new' } : undefined },
    { path: '/game/play', label: 'Fight', icon: Swords },
    { path: '/game/collection', label: 'Cards', icon: Images, badge: collectionRewardCount ? { label: String(collectionRewardCount), tone: 'reward' } : undefined },
    { path: '/game/decks', label: 'Crew', icon: UsersRound },
    { path: '/game/missions', label: 'Bounties', icon: Crown, badge: rewardCount ? { label: String(rewardCount), tone: 'reward' } : undefined },
    { path: '/game/shop', label: 'Tickets', icon: Ticket, badge: bootstrap.profile.packTickets ? { label: String(bootstrap.profile.packTickets), tone: 'notice' } : undefined },
    { path: '/game/settings', label: 'Profile', icon: Shield },
  ];

  return (
    <nav className="fight-nav" aria-label="Fight night navigation">
      <div className="fight-nav__brand" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}brand/squabblemon-wordmark.webp`}
          alt=""
          className="fight-nav__wordmark"
        />
        <div className="fight-nav__brand-rule">
          <span>Corner controls</span>
          <span>SB // 04</span>
        </div>
      </div>

      <div className="fight-nav__links">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.path || (link.path !== '/game' && location.startsWith(link.path));

          return (
            <button
              key={link.path}
              type="button"
              onClick={() => setLocation(link.path)}
              className={`fight-nav__button ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${link.label}${link.badge ? `, ${link.badge.label}` : ''}`}
            >
              <span className="fight-nav__icon-wrap" aria-hidden="true">
                <Icon className="fight-nav__icon" strokeWidth={isActive ? 2.5 : 2} />
                {link.badge && (
                  <span className={`fight-nav__badge is-${link.badge.tone}`}>
                    {link.badge.label}
                  </span>
                )}
              </span>
              <span className="fight-nav__label">{link.label}</span>
              <span className="fight-nav__active-mark" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function BootstrapError({
  onRetry,
  onPractice,
  isRetrying,
}: {
  onRetry: () => void;
  onPractice: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#070707] text-white p-6 flex flex-col items-center justify-center text-center">
      <img
        src={`${import.meta.env.BASE_URL}brand/squabblemon-crest.webp`}
        alt=""
        className="h-28 w-28 object-contain mb-5 opacity-90"
      />
      <div className="font-display font-black text-accent text-3xl italic uppercase mb-3">Block Offline</div>
      <p className="font-mono text-xs text-white/55 max-w-sm mb-7">
        Your corner could not be loaded. Retry the connection or keep your hands warm in offline practice.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-primary text-black px-6 py-3 font-display font-black italic uppercase text-sm disabled:opacity-50"
        >
          {isRetrying ? 'Retrying…' : 'Retry Connection'}
        </button>
        <button
          type="button"
          onClick={onPractice}
          className="bg-white/10 px-6 py-3 font-display font-black uppercase text-sm border border-white/20"
        >
          Play Offline Practice
        </button>
      </div>
    </div>
  );
}

function GameRoutes({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    document.documentElement.dataset.reduceMotion =
      bootstrap.profile.settings.reducedMotion ? 'true' : 'false';
  }, [bootstrap]);

  const availableDeckIds = starterRecipes
    .filter((recipe) =>
      validateSavedDeck(
        recipe.catalogCardIds,
        bootstrap.profile.ownedCardIds,
        recipe.hero,
      ).valid,
    )
    .map((recipe) => recipe.id);

  return (
    <Switch>
      <Route path="/game/onboarding">
        <Onboarding bootstrap={bootstrap} />
      </Route>
      <Route path="/game/play">
        <PlayLoop
          mode="practice"
          onExit={() => setLocation('/game')}
          turnTimerEnabled={bootstrap.profile.settings.turnTimerEnabled}
          availableDeckIds={availableDeckIds}
          equippedVariants={bootstrap.profile.equippedVariants}
          cardProgression={bootstrap.profile.cardProgression}
        />
      </Route>
      <Route path="/game/story/play/:nodeId">
        {(params) => (
          <PlayLoop
            mode="story"
            storyNodeId={params.nodeId}
            onExit={() => setLocation(`/game/story?node=${params.nodeId}`)}
            turnTimerEnabled={bootstrap.profile.settings.turnTimerEnabled}
            availableDeckIds={availableDeckIds}
            initialDeckId={bootstrap.profile.starterDeckId || availableDeckIds[0]}
            hideLobby
            equippedVariants={bootstrap.profile.equippedVariants}
          />
        )}
      </Route>
      <Route path="/game/collection">
        <GameShell bootstrap={bootstrap} location={location}><Collection bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/decks/:deckId/test">
        <GameShell bootstrap={bootstrap} location={location}><DeckTest bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/decks/:deckId">
        <GameShell bootstrap={bootstrap} location={location}><DeckEditor bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/decks">
        <GameShell bootstrap={bootstrap} location={location}><Decks bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/missions">
        <GameShell bootstrap={bootstrap} location={location}><Missions bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/shop">
        <GameShell bootstrap={bootstrap} location={location}><Shop bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/settings">
        <GameShell bootstrap={bootstrap} location={location}><Settings bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/story">
        <GameShell bootstrap={bootstrap} location={location}><Story bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game">
        <GameShell bootstrap={bootstrap} location={location}><Home bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route component={() => <Redirect to="/game" />} />
    </Switch>
  );
}

function GameShell({
  bootstrap,
  location,
  children,
}: {
  bootstrap: PlayerBootstrap;
  location: string;
  children: ReactNode;
}) {
  return (
        <div className="game-shell h-[100dvh] bg-[#070707] text-white">
          <div className="noise-overlay" />
          <FightNightNav bootstrap={bootstrap} />
          <div className="game-shell__content">
            <div className="game-route-stage" key={location}>
              {children}
            </div>
          </div>
        </div>
  );
}

export default function GameApp() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const [location, setLocation] = useLocation();
  const { data: bootstrap, isLoading, isFetching, error, refetch } = useGetPlayerBootstrap({
    query: {
      queryKey: getGetPlayerBootstrapQueryKey(),
      enabled: isLoaded && isSignedIn,
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      if (location.startsWith('/game')) sessionStorage.setItem('squabblemon_after_sign_in', location);
      setLocation('/sign-in');
    } else if (isLoaded && isSignedIn) {
      clearAfterSignIn();
    }
  }, [isLoaded, isSignedIn, location, setLocation]);

  if (!isLoaded || !isSignedIn || isLoading) return <LoadingScreen />;
  if (error || !bootstrap) {
    return (
      <BootstrapError
        onRetry={() => void refetch()}
        onPractice={() => setLocation('/play/guest')}
        isRetrying={isFetching}
      />
    );
  }

  const isComplete = bootstrap.profile.onboardingStep === 'complete';
  const normalizedLocation = location.length > 1 ? location.replace(/\/+$/, '') : location;
  const isOnboardingRoute = normalizedLocation === '/game/onboarding';
  if (!isComplete && !isOnboardingRoute) return <Redirect to="/game/onboarding" />;
  if (isComplete && isOnboardingRoute) return <Redirect to="/game" />;
  return <GameRoutes bootstrap={bootstrap} />;
}
