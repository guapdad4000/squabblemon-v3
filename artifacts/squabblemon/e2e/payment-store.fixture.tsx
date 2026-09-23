import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Router } from 'wouter';
import { useGetPlayerBootstrap } from '@workspace/api-client-react';
import { CityHeader } from '../src/components/venue/CityHeader';
import { CosmeticProvider } from '../src/components/CosmeticContext';
import { Shop } from '../src/pages/game/Shop';
import '../src/index.css';
import '../src/styles/studio.css';
import '../src/styles/venue.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0 },
    mutations: { retry: false },
  },
});

const fixtureParams = new URLSearchParams(window.location.search);
fixtureParams.delete('fixtureGamePath');
// Shop's real route contract is `view=corner` (not `tab=corner`).
if (!fixtureParams.has('view')) fixtureParams.set('view', 'corner');
window.history.replaceState(null, '', `/game/shop?${fixtureParams.toString()}`);

function MountedPaymentStore() {
  const bootstrap = useGetPlayerBootstrap();

  if (bootstrap.isLoading) {
    return <p role="status">Loading player account…</p>;
  }
  if (bootstrap.error || !bootstrap.data) {
    return <p role="alert">Player account unavailable.</p>;
  }

  return (
    <CosmeticProvider profile={bootstrap.data.profile}>
      <div className="game-shell game-shell--compact-nav h-[100dvh] bg-[#070707] text-white">
        <div className="noise-overlay" />
        <div className="game-shell__content">
          <CityHeader bootstrap={bootstrap.data} />
          <div className="game-route-stage">
            <Shop bootstrap={bootstrap.data} />
          </div>
        </div>
      </div>
    </CosmeticProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          <MountedPaymentStore />
        </ThemeProvider>
      </QueryClientProvider>
    </Router>
  </React.StrictMode>,
);