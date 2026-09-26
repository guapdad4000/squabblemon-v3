import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, useEffect, useRef } from 'react';

import { PublicEntry } from './pages/PublicEntry';
import { LoadingScreen } from './components/LoadingScreen';
import { basePath, stripBase } from './lib/routing';
import { guardDeckRouteNavigation } from './lib/deckExitGuard';
import { AppAuthProvider, useAppAuth, useAppClerk } from './lib/auth';

const SignInPage = lazy(() =>
  import('./pages/auth/SignIn').then((module) => ({ default: module.SignInPage })),
);
const SignUpPage = lazy(() =>
  import('./pages/auth/SignUp').then((module) => ({ default: module.SignUpPage })),
);
const GameApp = lazy(() => import('./pages/game/GameApp'));
const GameSoundtrack = lazy(() => import('./components/GameSoundtrack'));
const MoveStudio = lazy(() => import('./pages/MoveStudio'));
const StoryStudio = lazy(() => import('./pages/StoryStudio'));
const HowToPlay = lazy(() => import('./pages/HowToPlay'));
const SupportPage = lazy(() =>
  import('./pages/CustomerPolicy').then((module) => ({ default: module.SupportPage })),
);
const RefundPolicyPage = lazy(() =>
  import('./pages/CustomerPolicy').then((module) => ({ default: module.RefundPolicyPage })),
);
const GuestPlayLoop = lazy(() =>
  import('./components/PlayLoop').then((module) => ({
    default: function GuestPlayRoute() {
      const [, setLocation] = useLocation();
      return <module.PlayLoop mode="guest" onExit={() => setLocation('/')} />;
    },
  })),
);

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
    logoImageUrl: `${window.location.origin}${basePath}/brand/prismatic/logos/squabblemon-wordmark-gold.webp`,
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


const queryClient = new QueryClient();

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useAppClerk();
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
  const { isLoaded, isSignedIn } = useAppAuth();
  if (!isLoaded) return <LoadingScreen phase="account" />;
  if (isSignedIn) return <Redirect to="/game" />;
  return <PublicEntry />;
}

function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();
  const inGame = location === '/game' || location.startsWith('/game/') || location === '/play/guest';

  return (
    <AppAuthProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Back on the block',
            subtitle: 'Sign in to recover your gang and Street Rep',
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
          {inGame && <Suspense fallback={null}><GameSoundtrack /></Suspense>}
          <Suspense fallback={<LoadingScreen phase="scene" />}>
            <Switch>
              <Route path="/" component={PublicRedirect} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/play/guest" component={GuestPlayLoop} />
              <Route path="/how-to-play" component={HowToPlay} />
              <Route path="/support" component={SupportPage} />
              <Route path="/refund-policy" component={RefundPolicyPage} />
              <Route path="/moves" component={MoveStudio} />
              <Route path="/story-studio" component={StoryStudio} />
              <Route path="/game/*?" component={GameApp} />
              <Route component={() => <div className="min-h-[100dvh] bg-black text-white p-6 font-display font-black uppercase">404 — Unknown Street</div>} />
            </Switch>
          </Suspense>
        </MotionConfig>
      </QueryClientProvider>
    </AppAuthProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath} aroundNav={guardDeckRouteNavigation}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
