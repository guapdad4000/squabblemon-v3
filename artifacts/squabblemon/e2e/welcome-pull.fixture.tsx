import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { Shop } from '../src/pages/game/Shop';
import '../src/index.css';
import '../src/styles/venue.css';
const initial = {profile:{id:'welcome-fixture',packHistory:[],packTickets:0,softCurrency:0,styleShards:0,packPity:3,ownedCardIds:['dr-fade'],ownedVariants:[],equippedVariants:{},settings:{reducedMotion:new URLSearchParams(location.search).has('reduced'),turnTimerEnabled:false}},packConfig:{id:'street',name:'Street Pack',ticketCost:1,softCurrencyCost:100,rewardsPerPack:6,oddsVersion:'street-pack-v2',pityLimit:10,odds:[]}} as unknown as PlayerBootstrap;
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(getGetPlayerBootstrapQueryKey(),initial);
(window as any).__welcomeBootstrap=()=>client.getQueryData(getGetPlayerBootstrapQueryKey());
function Fixture(){const {data=initial}=useQuery({queryKey:getGetPlayerBootstrapQueryKey(),queryFn:async()=>initial,staleTime:Infinity});return <div style={{height:'100dvh'}}><Shop bootstrap={data}/></div>}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture/></QueryClientProvider>);
