import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { CharacterCollections } from '../src/pages/game/CharacterCollections';
import { profileBootstrap } from './fighter-id.fixture';
import '../src/index.css';
const initial = profileBootstrap({id:'finish-counter-player',ownedCardIds:['cornball','kyle'],discoveredCardIds:['cornball','kyle'],styleShards:200,styleShardBalances:{Common:60},settings:{reducedMotion:true,turnTimerEnabled:true}});
const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
function Sample() {
  const {data} = useQuery({queryKey:getGetPlayerBootstrapQueryKey(),queryFn:async()=>initial,initialData:initial,enabled:false});
  return <CharacterCollections bootstrap={data}/>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Sample/></QueryClientProvider>);
