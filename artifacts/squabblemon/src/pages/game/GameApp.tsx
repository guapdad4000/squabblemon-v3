import { installInteractionClickSounds } from '../../lib/interactionClickSounds';
import './gameStyles';
import { NotificationProvider } from '../../components/Notifications';
import { useNavigationScroll } from '../../lib/navigationMemory';
import { warmScreenArt } from '../../lib/screenArtWarmup';
import { PlayerLevelCelebration } from '../../components/AccountRewards';
import { CityHeader } from '../../components/venue/CityHeader';
import { rewardReceipts } from '../../lib/rewardReceipts';
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
import { Suspense, useEffect, type ReactNode } from 'react';
import { basePath, stripBase } from '../../lib/routing';
import { SocialProvider } from '../../lib/social';
import { clearSocialDestination, readSocialDestination, rememberSocialDestination, safeSocialDestination } from '../../lib/socialDestinations';
import { cardCatalog, starterRecipes } from '../../data';
import { STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import { Home, Events, PatchDesk, Inventory, CharacterStyles, CharacterCollections, Collection,
  DeckEditor, Decks, DeckTest, PlayerDeckPlay, Missions, Onboarding, Settings,
  Shop, Story, Multiplayer, ChallengesHub, preloadGameRoute, preloadAllGameRoutes } from './routeModules';
import { Redirect, Route, Switch, useLocation, useSearch } from 'wouter';
import '../../styles/paper-tabs.css';

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
    <div className="min-h-[100dvh] bg-background text-white p-6 flex flex-col items-center justify-center text-center">
      <img
        src={`${import.meta.env.BASE_URL}brand/prismatic/marks/impact-sm-gold.webp`}
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
          className="sq-press bg-primary text-black px-6 py-3 font-display font-black italic uppercase text-sm disabled:opacity-50"
        >
          {isRetrying ? 'Retrying…' : 'Retry Connection'}
        </button>
        <button
          type="button"
          onClick={onPractice}
          className="sq-press bg-white/10 px-6 py-3 font-display font-black uppercase text-sm border border-white/20"
        >
          Play Offline Practice
        </button>
      </div>
    </div>
  );
}

function ImmersiveGameRoute({ bootstrap, children }: { bootstrap: PlayerBootstrap; children: ReactNode }) {
  return <div className="immersive-shell"><CityHeader bootstrap={bootstrap} /><Suspense fallback={null}>{children}</Suspense></div>;
}

function GameRoutes({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  useNavigationScroll();
  useEffect(() => { rewardReceipts.reset(); return () => rewardReceipts.reset(); }, [bootstrap.profile.id]);
  const [location, setLocation] = useLocation();
  const search = useSearch();
  useEffect(() => {
    if (bootstrap.profile.onboardingStep !== 'complete') return;
    const options = { base: basePath, origin: window.location.origin };
    const destination = safeSocialDestination(`${location}${search ? `?${search}` : ''}${window.location.hash}`, basePath, options.origin);
    if (destination && destination === readSocialDestination(sessionStorage, bootstrap.profile.id, options)) {
      // Reaching the confirmation screen consumes the redirect, not the invitation itself.
      clearSocialDestination(sessionStorage);
    }
  }, [bootstrap.profile.id, bootstrap.profile.onboardingStep, location, search]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion =
      bootstrap.profile.settings.reducedMotion ? 'true' : 'false';
  }, [bootstrap.profile.settings.reducedMotion]);

  useEffect(() => { preloadAllGameRoutes(); warmScreenArt(); }, []);

  useEffect(() => {
    const warmDestination = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>('a[href], [data-preload-route]');
      if (!target) return;
      const route = target.dataset.preloadRoute;
      if (route) { preloadGameRoute(route); return; }
      const url = new URL(target.getAttribute('href')!, window.location.href);
      if (url.origin === window.location.origin && url.pathname.startsWith(`${basePath}/game`)) {
        preloadGameRoute(stripBase(url.pathname));
      }
    };
    document.addEventListener('pointerover', warmDestination, { passive: true });
    document.addEventListener('focusin', warmDestination);
    document.addEventListener('pointerdown', warmDestination, { passive: true });
    return () => {
      document.removeEventListener('pointerover', warmDestination);
      document.removeEventListener('focusin', warmDestination);
      document.removeEventListener('pointerdown', warmDestination);
    };
  }, []);

  return (
    <SocialProvider key={bootstrap.profile.id} accountId={bootstrap.profile.id} enabled={bootstrap.profile.onboardingStep === 'complete'}>
    <CosmeticProvider profile={bootstrap.profile}>
    <NotificationProvider key={bootstrap.profile.id} bootstrap={bootstrap}>
    <RewardReveal />
    <PlayerLevelCelebration profile={bootstrap.profile} />
    <Suspense fallback={<LoadingScreen phase="scene" />}>
    <Switch>
      <Route path="/game/onboarding">
        <Onboarding bootstrap={bootstrap} />
      </Route>
      <Route path="/game/play"><Redirect to="/game/training" /></Route>
      <Route path="/game/training"><ImmersiveGameRoute bootstrap={bootstrap}><ChallengesHub bootstrap={bootstrap} trainingOnly /></ImmersiveGameRoute></Route>
      <Route path="/game/challenges"><ImmersiveGameRoute bootstrap={bootstrap}><ChallengesHub bootstrap={bootstrap} /></ImmersiveGameRoute></Route>
      <Route path="/game/online/:code">{params => <ImmersiveGameRoute bootstrap={bootstrap}><Multiplayer key={params.code} code={params.code.toUpperCase()} bootstrap={bootstrap} /></ImmersiveGameRoute>}</Route>
      <Route path="/game/online"><ImmersiveGameRoute bootstrap={bootstrap}><Multiplayer bootstrap={bootstrap} /></ImmersiveGameRoute></Route>
      <Route path="/game/story/play/:nodeId">{params => <ImmersiveGameRoute bootstrap={bootstrap}><PlayerDeckPlay key={params.nodeId} bootstrap={bootstrap} storyNodeId={params.nodeId} /></ImmersiveGameRoute>}</Route>
      <Route path="/game/inventory"><GameShell bootstrap={bootstrap} location={location}><Inventory bootstrap={bootstrap} /></GameShell></Route>
      <Route path="/game/events"><GameShell bootstrap={bootstrap} location={location}><Events key={bootstrap.profile.id} playerId={bootstrap.profile.id} /></GameShell></Route>
      <Route path="/game/admin/patches"><GameShell bootstrap={bootstrap} location={location}><PatchDesk /></GameShell></Route>
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
    </Suspense>
    </NotificationProvider>
    </CosmeticProvider>
    </SocialProvider>
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
              <Suspense fallback={null}>{children}</Suspense>
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
      softCurrencyCost: STREET_PACK_RULES.single.softCurrencyCost,
      ticketCost: STREET_PACK_RULES.single.ticketCost,
      rewardsPerPack: STREET_PACK_RULES.single.rewards,
      pityLimit: STREET_PACK_RULES.pityLimit,
      odds: [],
    },
    tenPullConfig: {
      id: 'e2e-ten-pull',
      name: 'Practice Ten Pull',
      oddsVersion: 'e2e',
      pullCount: 10,
      ticketCost: STREET_PACK_RULES.ten.ticketCost,
      softCurrencyCost: STREET_PACK_RULES.ten.softCurrencyCost,
      rewardsPerPull: STREET_PACK_RULES.single.rewards,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

export default function GameApp() {
  useEffect(installInteractionClickSounds, []);
  const { isLoaded, isSignedIn } = useAppAuth();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { data: apiBootstrap, isLoading, isFetching, error, refetch } = useGetPlayerBootstrap({
    query: {
      queryKey: getGetPlayerBootstrapQueryKey(),
      enabled: isLoaded && isSignedIn,
    },
  });

  // Fetch the requested screen while the account/profile gate is still loading.
  useEffect(() => { preloadGameRoute(location); }, [location]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const destination = `${location}${search ? `?${search}` : ''}${window.location.hash}`;
      rememberSocialDestination(sessionStorage, destination, null, { base: basePath, origin: window.location.origin });
      if (location.startsWith('/game')) {
        try { sessionStorage.setItem('squabblemon_after_sign_in', destination); } catch { /* The current confirmation remains available through its shared link. */ }
      }
      setLocation('/sign-in');
    } else if (isLoaded && isSignedIn) {
      clearAfterSignIn();
    }
  }, [isLoaded, isSignedIn, location, search, setLocation]);

  if (!isLoaded || !isSignedIn) return <LoadingScreen phase="account" />;
  if (isLoading) return <LoadingScreen phase="player" />;

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
  const destinationOptions = { base: basePath, origin: window.location.origin };
  if (!isComplete && !isOnboardingRoute) {
    rememberSocialDestination(sessionStorage, `${location}${search ? `?${search}` : ''}${window.location.hash}`, bootstrap.profile.id, destinationOptions);
    return <Redirect to="/game/onboarding" />;
  }
  if (isComplete && isOnboardingRoute) {
    const invite = readSocialDestination(sessionStorage, bootstrap.profile.id, destinationOptions);
    return <Redirect to={invite ?? '/game'} />;
  }
  return <GameRoutes bootstrap={bootstrap} />;
}
