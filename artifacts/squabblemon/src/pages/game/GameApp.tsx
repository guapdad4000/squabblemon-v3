import { installGameSurfacePolicy } from '../../lib/gameSurfacePolicy';
import { installInteractionClickSounds } from '../../lib/interactionClickSounds';
import './gameStyles';
import { NotificationProvider } from '../../components/Notifications';
import { useNavigationScroll } from '../../lib/navigationMemory';
import { PlayerLevelCelebration } from '../../components/PlayerLevelCelebration';
import { CityHeader } from '../../components/venue/CityHeader';
import { rewardReceipts } from '../../lib/rewardReceiptStore';
import { CosmeticProvider } from '../../components/cosmeticState';
import { RewardRevealGate } from '../../components/RewardRevealGate';
import { KumiteUnlockGate } from '../../components/kumite/KumiteUnlockGate';
import { clearAfterSignIn, e2eAuthEnabled, useAppAuth } from '../../lib/auth';
import { LoadingScreen } from '../../components/LoadingScreen';
import {
  getGetPlayerBootstrapQueryKey,
  useGetPlayerBootstrap,
} from '@workspace/api-client-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { GameNav } from '../../components/venue/GameNav';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { basePath, stripBase } from '../../lib/routing';
import { SocialProvider } from '../../lib/social';
import { clearSocialDestination, readSocialDestination, rememberSocialDestination, safeSocialDestination } from '../../lib/socialDestinations';
import { Home, Events, PatchDesk, Inventory, CharacterStyles, CharacterCollections, Collection,
  DeckEditor, Decks, DeckTest, PlayerDeckPlay, Missions, Onboarding, Settings,
  Shop, Story, Multiplayer, Kumite, ChallengesHub, preloadGameRoute } from './routeModules';
import { Redirect, Route, Switch, useLocation, useSearch } from 'wouter';
import '../../styles/paper-tabs.css';

// Development fixtures must never make the production shell parse the full card catalog.
const E2EGamePreview = import.meta.env.DEV ? lazy(() => import('./E2EGamePreview')) : null;
const BagRewardArrival = lazy(() => import('../../components/BagRewardArrival').then(module => ({ default: module.BagRewardArrival })));
const DailyCheckInArrival = lazy(() => import('../../components/DailyCheckInArrival').then(module => ({ default: module.DailyCheckInArrival })));

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

  // The requested route is prepared while bootstrap loads; other screens warm only on navigation intent.
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
    <RewardRevealGate />
    {(location === '/game' || location === '/game/shop') && bootstrap.profile.onboardingStep === 'complete' && <Suspense fallback={null}><BagRewardArrival key={bootstrap.profile.id} profile={bootstrap.profile} /></Suspense>}
    <KumiteUnlockGate key={bootstrap.profile.id} bootstrap={bootstrap} />
    <PlayerLevelCelebration profile={bootstrap.profile} />
    {location === '/game' && bootstrap.profile.onboardingStep === 'complete' && <Suspense fallback={null}><DailyCheckInArrival key={bootstrap.profile.id} bootstrap={bootstrap} /></Suspense>}
    <Suspense fallback={<LoadingScreen phase="scene" />}>
    <Switch>
      <Route path="/game/onboarding">
        <Onboarding bootstrap={bootstrap} />
      </Route>
      <Route path="/game/play"><Redirect to="/game/training" /></Route>
      <Route path="/game/training"><ImmersiveGameRoute bootstrap={bootstrap}><ChallengesHub bootstrap={bootstrap} openTraining /></ImmersiveGameRoute></Route>
      <Route path="/game/challenges"><ImmersiveGameRoute bootstrap={bootstrap}><ChallengesHub bootstrap={bootstrap} /></ImmersiveGameRoute></Route>
      <Route path="/game/kumite"><Kumite bootstrap={bootstrap} /></Route>
      <Route path="/game/online/:code">{params => <ImmersiveGameRoute bootstrap={bootstrap}><Multiplayer key={params.code} code={params.code.toUpperCase()} bootstrap={bootstrap} /></ImmersiveGameRoute>}</Route>
      <Route path="/game/online"><ImmersiveGameRoute bootstrap={bootstrap}><Multiplayer bootstrap={bootstrap} /></ImmersiveGameRoute></Route>
      <Route path="/game/story/play/:nodeId">{params => <ImmersiveGameRoute bootstrap={bootstrap}><PlayerDeckPlay key={params.nodeId} bootstrap={bootstrap} storyNodeId={params.nodeId} /></ImmersiveGameRoute>}</Route>
      <Route path="/game/inventory"><GameShell bootstrap={bootstrap} location={location}><Inventory bootstrap={bootstrap} /></GameShell></Route>
      <Route path="/game/events"><GameShell bootstrap={bootstrap} location={location}><Events key={bootstrap.profile.id} playerId={bootstrap.profile.id} bootstrap={bootstrap} /></GameShell></Route>
      <Route path="/game/admin/patches"><GameShell bootstrap={bootstrap} location={location}><PatchDesk /></GameShell></Route>
      <Route path="/game/mats"><Redirect to="/game/style?view=mats" /></Route>
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


export default function GameApp() {
  useEffect(installInteractionClickSounds, []);
  useEffect(installGameSurfacePolicy, []);
  const { isLoaded, isSignedIn } = useAppAuth();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { data: apiBootstrap, isLoading, isFetching, refetch } = useGetPlayerBootstrap({
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
  if (e2eAuthEnabled && E2EGamePreview && !apiBootstrapValid) {
    return <Suspense fallback={<LoadingScreen phase="player" />}><E2EGamePreview>{preview => <GameRoutes bootstrap={preview} />}</E2EGamePreview></Suspense>;
  }
  const bootstrap: PlayerBootstrap | undefined = apiBootstrapValid ? (apiBootstrap as PlayerBootstrap) : undefined;

  // A failed background refresh must not unmount an active battle or its
  // unsaved receipt. Auth changes still leave through the account gate above.
  if (!bootstrap) {
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
