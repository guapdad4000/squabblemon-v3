import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {getGetPlayerBootstrapQueryKey,type PlayerBootstrap} from '@workspace/api-client-react';
import {ROOKIE_MENTOR_CORE_IDS} from '@workspace/squabblemon-engine/data';
import {EARNED_DECK_COVERS} from '@workspace/squabblemon-engine/cosmetics';
import {CosmeticProvider} from '../src/components/cosmeticState';
import {DeckWorkbench} from '../src/components/DeckWorkbench';
import '../src/index.css';
const earned=new URLSearchParams(location.search).has('earned');
const deck={name:'The Ancient Road',cardIds:[...ROOKIE_MENTOR_CORE_IDS],heroCardId:ROOKIE_MENTOR_CORE_IDS[0],recipeId:null};
let bootstrap={profile:{id:'earned-cover-review',settings:{reducedMotion:true,turnTimerEnabled:false,cosmetics:{}},ownedCardIds:[...ROOKIE_MENTOR_CORE_IDS],equippedVariants:{},ownedVariants:[],cardProgression:{},unlockedCosmeticIds:earned?EARNED_DECK_COVERS.map(cover=>cover.id):[]}} as unknown as PlayerBootstrap;
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(!url.endsWith('/api/player/cosmetics'))return realFetch(input,init);bootstrap={...bootstrap,profile:{...bootstrap.profile,settings:{...bootstrap.profile.settings,cosmetics:JSON.parse(String(init?.body))}}};return new Response(JSON.stringify(bootstrap),{status:200,headers:{'content-type':'application/json'}});};
const client=new QueryClient();client.setQueryData(getGetPlayerBootstrapQueryKey(),bootstrap);
function Fixture(){const{data}=useQuery({queryKey:getGetPlayerBootstrapQueryKey(),initialData:bootstrap,enabled:false});return <CosmeticProvider profile={data.profile}><div style={{height:'100dvh',background:'#0d1110',color:'white'}}><DeckWorkbench initial={deck} ownedCardIds={data.profile.ownedCardIds} equippedVariants={{}} onSave={async()=>{}} onTest={async()=>{}} /></div></CosmeticProvider>;}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture/></QueryClientProvider>);
