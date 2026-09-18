import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetPlayerStory } from '@workspace/api-client-react';
import { NodeOverlay } from '../src/pages/game/Story';
import '../src/index.css';
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function Fixture() {
  const { data } = useGetPlayerStory();
  return <div style={{ position: 'relative', height: '100dvh' }}>{data && <NodeOverlay nodeId="welcome-to-the-block" campaign={data} onClose={() => { document.title = 'Returned to map'; }} onStartBattle={() => { document.title = 'Real battle route requested'; }} />}</div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
