import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { profileBootstrap } from './fighter-id.fixture';
import { Missions } from '../src/pages/game/Missions';
import { StarterMythic } from '../src/components/StarterMythic';
import { getAssetUrl } from '../src/lib/assets';
import '../src/index.css';
import '../src/styles/safehouse-stage.css';
const initial = profileBootstrap({id:'mythic-fixture', settings:{reducedMotion:true,turnTimerEnabled:false}});
const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
client.setQueryData(getGetPlayerBootstrapQueryKey(), initial);
(window as any).__mythicBootstrap = () => client.getQueryData(getGetPlayerBootstrapQueryKey());
function Fixture() {
  const {data = initial} = useQuery({queryKey:getGetPlayerBootstrapQueryKey(),queryFn:async()=>initial,staleTime:Infinity});
  const shortcut = new URLSearchParams(location.search).get('screen') === 'home';
  return shortcut ? <div style={{position:'relative',height:'100dvh',background:'#121b17'}}>
    <a className="safehouse-bounty-logo" href="#bounties" aria-label="Bounties"><img src={getAssetUrl('assets/bounty-hunter/hero.webp')} alt="" /></a>
    <StarterMythic bootstrap={data} placement="shortcut" autoShow={new URLSearchParams(location.search).has('auto')} />
  </div> : <div style={{height:'100dvh'}}><Missions bootstrap={data} /></div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
