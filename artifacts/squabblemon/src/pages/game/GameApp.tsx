import { CityHeader } from '../../components/venue/CityHeader';
import { rewardReceipts } from '../../lib/rewardReceipts';
import { Inventory } from './Inventory';
import { CharacterStyles } from './CharacterStyles';
import { CharacterCollections } from './CharacterCollections';
import { CosmeticProvider } from '../../components/CosmeticContext';
import { RewardReveal } from '../../components/RewardReveal';
import { clearAfterSignIn, e2eAuthEnabled, useAppAuth } from '../../lib/auth';
import { LoadingScreen } from '../../components/LoadingScreen';
import { readPreviewDecks } from '../../lib/previewDecks';
import {
  getGetPlayerBootstrapQueryKey,
  useGetPlayerBootstrap,
} from '@workspace/api-client-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { GameNav } from '../../components/venue/GameNav';
import { useEffect, type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';

import { cardCatalog, starterRecipes } from '../../data';
import { Collection } from './Collection';
import { DeckEditor } from './DeckEditor';
import { Decks } from './Decks';
import { DeckTest } from './DeckTest';
import { PlayerDeckPlay } from './PlayerDeckPlay';
import { Home } from './Home';
import { Missions } from './Missions';
import { Onboarding } from './Onboarding';
import { Settings } from './Settings';
import { Shop } from './Shop';
import { Story } from './Story';
import { Multiplayer } from './Multiplayer';


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

function ImmersiveGameRoute({ bootstrap, children }: { bootstrap: PlayerBootstrap; children: ReactNode }) {
  return <div className="immersive-shell"><CityHeader bootstrap={bootstrap} />{children}</div>;
}

function GameRoutes({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  useEffect(() => { rewardReceipts.reset(); return () => rewardReceipts.reset(); }, [bootstrap.profile.id]);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    document.documentElement.dataset.reduceMotion =
      bootstrap.profile.settings.reducedMotion ? 'true' : 'false';
  }, [bootstrap]);

  return (
    <CosmeticProvider profile={bootstrap.profile}>
    <RewardReveal />
    <Switch>
      <Route path="/game/onboarding">
        <Onboarding bootstrap={bootstrap} />
      </Route>
      <Route path="/game/play"><ImmersiveGameRoute bootstrap={bootstrap}><PlayerDeckPlay bootstrap={bootstrap} /></ImmersiveGameRoute></Route>
      <Route path="/game/online/:code">{params => <ImmersiveGameRoute bootstrap={bootstrap}><Multiplayer key={params.code} code={params.code.toUpperCase()} bootstrap={bootstrap} /></ImmersiveGameRoute>}</Route>
      <Route path="/game/online"><ImmersiveGameRoute bootstrap={bootstrap}><Multiplayer bootstrap={bootstrap} /></ImmersiveGameRoute></Route>
      <Route path="/game/story/play/:nodeId">{params => <ImmersiveGameRoute bootstrap={bootstrap}><PlayerDeckPlay key={params.nodeId} bootstrap={bootstrap} storyNodeId={params.nodeId} /></ImmersiveGameRoute>}</Route>
      <Route path="/game/inventory"><GameShell bootstrap={bootstrap} location={location}><Inventory bootstrap={bootstrap} /></GameShell></Route>
      <Route path="/game/style"><GameShell bootstrap={bootstrap} location={location}><CharacterCollections bootstrap={bootstrap} /></GameShell></Route>
      <Route path="/game/style/:cardId">{params => <GameShell bootstrap={bootstrap} location={location}><CharacterStyles key={params.cardId} cardId={params.cardId} bootstrap={bootstrap} /></GameShell>}</Route>
      <Route path="/game/collection">
        <GameShell bootstrap={bootstrap} location={location}><Collection bootstrap={bootstrap} /></GameShell>
      </Route>
      <Route path="/game/decks/:deckId/test">
        <ImmersiveGameRoute bootstrap={bootstrap}><DeckTest bootstrap={bootstrap} /></ImmersiveGameRoute>
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
    </CosmeticProvider>
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
  const pathname = location.split(/[?#]/, 1)[0] || '/game';
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const navigationLayout = normalized === '/game' ? 'game-shell--fan' : 'game-shell--compact-nav';
  return (
        <div className={`game-shell ${navigationLayout} h-[100dvh] bg-[#070707] text-white`}>
          <div className="noise-overlay" />
          {normalized === '/game' && <GameNav bootstrap={bootstrap} />}
          <div className="game-shell__content">
            <CityHeader bootstrap={bootstrap} />
            <div className="game-route-stage" key={location}>
              {children}
            </div>
          </div>
        </div>
  );
}

// Offline fallback bootstrap used when VITE_E2E_AUTH=true and the API server
// isn't running. Lets the entire /game shell render so QA can exercise every
// route without a live Postgres + Clerk stack. The shape mirrors the API
// contract in @workspace/api-client-react so the typed components stay happy.
function getE2EBootstrap(): PlayerBootstrap {
  // The local preview must allow testing expansion cards as well as starter crews.
  const allCardIds = cardCatalog.map(card => card.catalogId);
  const equippedVariants: Record<string, string> = {};
  const cardProgression: Record<string, { xp: number; level: number }> = {};
  for (const cardId of allCardIds) {
    cardProgression[cardId] = { xp: 0, level: 1 };
  }
  const now = new Date().toISOString();
  return {
    profile: {
      id: 'e2e-player',
      displayName: 'Test Player',
      avatarKey: 'cornball',
      onboardingStep: 'complete',
      starterDeckId: starterRecipes[0]?.id ?? null,
      streetRep: 0,
      xp: 0,
      level: 1,
      softCurrency: 500,
      packTickets: 3,
      styleShards: 0,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 0,
      storyNode: 0,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      settings: { reducedMotion: false, turnTimerEnabled: true },
      ownedCardIds: allCardIds,
      cardProgression,
      discoveredCardIds: allCardIds,
      ownedVariants: [],
      equippedVariants,
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: readPreviewDecks(),
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: now,
    },
    missions: [],
    nextAction: {
      id: 'e2e-next',
      eyebrow: 'Tonight',
      title: 'Run the block',
      description: 'Take two of three districts in an offline practice fade.',
      destination: 'play',
      rewardLabel: null,
    },
    packConfig: {
      id: 'e2e-pack',
      name: 'Practice Pack',
      oddsVersion: 'e2e',
      softCurrencyCost: 200,
      ticketCost: 1,
      rewardsPerPack: 6,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'e2e-ten-pull',
      name: 'Practice Ten Pull',
      oddsVersion: 'e2e',
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 1800,
      rewardsPerPull: 6,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

export default function GameApp() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const [location, setLocation] = useLocation();
  const { data: apiBootstrap, isLoading, isFetching, error, refetch } = useGetPlayerBootstrap({
    query: {
      queryKey: getGetPlayerBootstrapQueryKey(),
      enabled: isLoaded && isSignedIn,
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      if (/^\/game\/online\/[a-f0-9]{12}$/i.test(location)) sessionStorage.setItem('squabblemon_friend_invite', location);
      if (location.startsWith('/game')) sessionStorage.setItem('squabblemon_after_sign_in', location);
      setLocation('/sign-in');
    } else if (isLoaded && isSignedIn) {
      clearAfterSignIn();
    }
  }, [isLoaded, isSignedIn, location, setLocation]);

  if (!isLoaded || !isSignedIn || isLoading) return <LoadingScreen />;

  // The API may return 200 OK with the Vite SPA fallback (HTML) when the
  // server isn't running, so customFetch hands us a string instead of a
  // parsed object. Only treat the response as a real bootstrap when it has
  // the expected shape; in e2e mode fall back to a synthetic payload so
  // the rest of /game stays navigable for QA.
  const apiBootstrapValid =
    !!apiBootstrap &&
    typeof apiBootstrap === 'object' &&
    'profile' in apiBootstrap &&
    !!apiBootstrap.profile &&
    'onboardingStep' in apiBootstrap.profile;
  const bootstrap: PlayerBootstrap | undefined = e2eAuthEnabled
    ? apiBootstrapValid
      ? (apiBootstrap as PlayerBootstrap)
      : getE2EBootstrap()
    : (apiBootstrap as PlayerBootstrap | undefined);

  if ((!e2eAuthEnabled && error) || !bootstrap) {
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
  if (!isComplete && !isOnboardingRoute) {
    if (/^\/game\/online\/[a-f0-9]{12}$/i.test(location)) sessionStorage.setItem('squabblemon_friend_invite', location);
    return <Redirect to="/game/onboarding" />;
  }
  if (isComplete && isOnboardingRoute) {
    const invite = sessionStorage.getItem('squabblemon_friend_invite');
    return <Redirect to={invite && /^\/game\/online\/[a-f0-9]{12}$/i.test(invite) ? invite : '/game'} />;
  }
  return <GameRoutes bootstrap={bootstrap} />;
}
