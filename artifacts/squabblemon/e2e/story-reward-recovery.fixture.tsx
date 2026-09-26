import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetPlayerStory } from '@workspace/api-client-react';
import { NodeOverlay } from '../src/pages/game/Story';
import { RewardReveal } from '../src/components/RewardReveal';
import '../src/index.css';
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function Fixture() {
 const {data} = useGetPlayerStory();
 const nodeId = new URLSearchParams(location.search).get('node') ?? 'block-crowned';
 return <div style={{position:'relative',height:'100dvh'}}>{data && <NodeOverlay nodeId={nodeId} campaign={data} onClose={()=>{document.title='Map'}} onStartBattle={()=>{}} />}<RewardReveal /></div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
