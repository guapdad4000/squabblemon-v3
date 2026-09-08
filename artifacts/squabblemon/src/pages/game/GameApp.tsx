import { useAppAuth } from '../../lib/auth';
import {
  getGetPlayerBootstrapQueryKey,
  useGetPlayerBootstrap,
} from '@workspace/api-client-react';
import { useEffect } from 'react';
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

function BottomNav() {
  const [location, setLocation] = useLocation();
  const links = [
    { path: '/game', label: 'Hub' },
    { path: '/game/collection', label: 'Cards' },
    { path: '/game/decks', label: 'Decks' },
    { path: '/game/missions', label: 'Missions' },
    { path: '/game/shop', label: 'Shop' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 h-16 bg-black/90 backdrop-blur-md border-t border-white/10 flex justify-around items-center px-2 pb-[env(safe-area-inset-bottom)] z-50">
      {links.map((link) => (
        <button
          key={link.path}
          onClick={() => setLocation(link.path)}
          className={`flex-1 flex flex-col items-center justify-center font-mono text-[9px] uppercase tracking-widest ${location === link.path ? 'text-primary' : 'text-white/40 hover:text-white/80'}`}
        >
          {link.label}
        </button>
      ))}
    </nav>
  );
}

function GameRoutes() {
  const { data: bootstrap } = useGetPlayerBootstrap();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!bootstrap) return;
    document.documentElement.dataset.reduceMotion =
      bootstrap.profile.settings.reducedMotion ? 'true' : 'false';
  }, [bootstrap]);

  if (!bootstrap) return null;
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
      <Route path="/game" nest>
        <div className="flex flex-col h-[100dvh] bg-[#070707] text-white">
          <div className="noise-overlay" />
          <div className="flex-1 min-h-0 relative z-10">
            <Switch>
              <Route path="/"><Home bootstrap={bootstrap} /></Route>
              <Route path="/collection"><Collection bootstrap={bootstrap} /></Route>
              <Route path="/decks"><Decks bootstrap={bootstrap} /></Route>
              <Route path="/decks/:deckId"><DeckEditor bootstrap={bootstrap} /></Route>
              <Route path="/decks/:deckId/test"><DeckTest bootstrap={bootstrap} /></Route>
              <Route path="/missions"><Missions bootstrap={bootstrap} /></Route>
              <Route path="/shop"><Shop bootstrap={bootstrap} /></Route>
              <Route path="/settings"><Settings bootstrap={bootstrap} /></Route>
              <Route path="/story"><Story /></Route>
              <Route component={() => <Redirect to="/game" />} />
            </Switch>
          </div>
          <BottomNav />
        </div>
      </Route>
    </Switch>
  );
}

export default function GameApp() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const [location, setLocation] = useLocation();
  const { data: bootstrap, isLoading, error } = useGetPlayerBootstrap({
    query: {
      queryKey: getGetPlayerBootstrapQueryKey(),
      enabled: isLoaded && isSignedIn,
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation('/sign-in');
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn || isLoading) return <LoadingScreen />;
  if (error || !bootstrap) {
    return (
      <div className="min-h-[100dvh] bg-black text-white p-6 flex flex-col items-center justify-center text-center">
        <div className="font-display font-black text-accent text-3xl italic uppercase mb-4">Offline</div>
        <p className="font-mono text-xs text-white/50 mb-8">Could not connect to the server.</p>
        <button onClick={() => setLocation('/play/guest')} className="bg-white/10 px-6 py-3 font-display font-black uppercase text-sm border border-white/20">Play Offline Practice</button>
      </div>
    );
  }

  const isComplete = bootstrap.profile.onboardingStep === 'complete';
  const isOnboardingRoute = location === '/game/onboarding';
  if (!isComplete && !isOnboardingRoute) return <Redirect to="/game/onboarding" />;
  if (isComplete && isOnboardingRoute) return <Redirect to="/game" />;
  return <GameRoutes />;
}
