import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { useGetPlayerBootstrap } from '@workspace/api-client-react';

import { PublicEntry } from './pages/PublicEntry';
import { SignInPage } from './pages/auth/SignIn';
import { SignUpPage } from './pages/auth/SignUp';
import { Onboarding } from './pages/game/Onboarding';
import { Home } from './pages/game/Home';
import { Collection } from './pages/game/Collection';
import { Missions } from './pages/game/Missions';
import { Shop } from './pages/game/Shop';
import { Settings } from './pages/game/Settings';
import { Story } from './pages/game/Story';
import { PlayLoop } from './components/PlayLoop';
import { basePath, stripBase } from './lib/routing';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#facc15',
    colorForeground: '#ffffff',
    colorMutedForeground: '#a1a1aa',
    colorDanger: '#f43f5e',
    colorBackground: '#111111',
    colorInput: '#18181b',
    colorInputForeground: '#ffffff',
    colorNeutral: '#52525b',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    borderRadius: '0px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#111111] w-[440px] max-w-full overflow-hidden border border-white/15 shadow-2xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-display font-black italic uppercase text-white',
    headerSubtitle: 'font-mono text-[10px] text-white/55 uppercase tracking-widest',
    socialButtonsBlockButton: 'border border-white/20 bg-white/5 text-white hover:bg-white/10 rounded-none',
    socialButtonsBlockButtonText: 'font-sans font-bold',
    dividerLine: 'bg-white/10',
    dividerText: 'font-mono text-[9px] text-white/40 uppercase',
    formFieldLabel: 'font-mono text-[9px] text-white/65 uppercase tracking-wider',
    formFieldInput: 'bg-zinc-900 border border-white/20 text-white rounded-none focus:border-primary focus:ring-1 focus:ring-primary',
    formButtonPrimary: 'bg-primary text-black font-display font-black italic uppercase rounded-none hover:bg-yellow-400',
    footerActionText: 'text-white/50',
    footerActionLink: 'text-primary hover:text-yellow-300 font-bold',
  },
};

function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] bg-black text-primary font-display font-black italic uppercase flex items-center justify-center text-2xl">
      Loading...
    </div>
  );
}

function BottomNav() {
  const [location, setLocation] = useLocation();
  
  const links = [
    { path: '/game', label: 'Hub' },
    { path: '/game/collection', label: 'Cards' },
    { path: '/game/missions', label: 'Missions' },
    { path: '/game/shop', label: 'Shop' },
    { path: '/game/settings', label: 'Menu' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 h-16 bg-black/90 backdrop-blur-md border-t border-white/10 flex justify-around items-center px-2 pb-[env(safe-area-inset-bottom)] z-50">
      {links.map(l => (
        <button 
          key={l.path} 
          onClick={() => setLocation(l.path)}
          className={`flex-1 flex flex-col items-center justify-center font-mono text-[9px] uppercase tracking-widest ${location === l.path ? 'text-primary' : 'text-white/40 hover:text-white/80'}`}
        >
          {l.label}
        </button>
      ))}
    </nav>
  );
}

function GameBootstrapProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/sign-in');
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) return <LoadingScreen />;

  return <GameLoader>{children}</GameLoader>;
}

function GameLoader({ children }: { children: React.ReactNode }) {
  const { data: bootstrap, isLoading, error } = useGetPlayerBootstrap();
  const [location, setLocation] = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (error || !bootstrap) return (
    <div className="min-h-[100dvh] bg-black text-white p-6 flex flex-col items-center justify-center text-center">
      <div className="font-display font-black text-accent text-3xl italic uppercase mb-4">Offline</div>
      <p className="font-mono text-xs text-white/50 mb-8">Could not connect to the server.</p>
      <button onClick={() => setLocation('/play/guest')} className="bg-white/10 px-6 py-3 font-display font-black uppercase text-sm border border-white/20">Play Offline Practice</button>
    </div>
  );

  const isComplete = bootstrap.profile.onboardingStep === 'complete';
  const isOnboardingRoute = location === '/game/onboarding';

  if (!isComplete && !isOnboardingRoute) {
    return <Redirect to="/game/onboarding" />;
  }

  if (isComplete && isOnboardingRoute) {
    return <Redirect to="/game" />;
  }

  return <>{children}</>;
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
        />
      </Route>

      <Route path="/game" nest>
        <div className="flex flex-col h-[100dvh] bg-[#070707] text-white">
          <div className="noise-overlay" />
          <div className="flex-1 min-h-0 relative z-10">
            <Switch>
              <Route path="/"><Home bootstrap={bootstrap} /></Route>
              <Route path="/collection"><Collection bootstrap={bootstrap} /></Route>
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

const queryClient = new QueryClient();

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function PublicRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (isSignedIn) return <Redirect to="/game" />;
  return <PublicEntry />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Back on the block',
            subtitle: 'Sign in to recover your crew and Street Rep',
          },
        },
        signUp: {
          start: {
            title: 'Claim your fighter tag',
            subtitle: 'Create an account and start Rookie Road',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <MotionConfig reducedMotion="user">
          <Switch>
            <Route path="/" component={PublicRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/play/guest">
              <PlayLoop mode="guest" onExit={() => setLocation('/')} />
            </Route>

            <Route path="/game/*?">
              <GameBootstrapProvider>
                <GameRoutes />
              </GameBootstrapProvider>
            </Route>
            <Route component={() => <div className="min-h-[100dvh] bg-black text-white p-6 font-display font-black uppercase">404 — Unknown Street</div>} />
          </Switch>
        </MotionConfig>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}