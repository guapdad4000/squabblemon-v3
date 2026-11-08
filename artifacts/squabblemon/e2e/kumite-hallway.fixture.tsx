import '../src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { cardCatalog, starterRecipes } from '../src/data';
import { Kumite } from '../src/pages/game/Kumite';
import BreakthroughOnline from '../src/components/breakthrough/BreakthroughOnline';
if (!import.meta.env.DEV) throw Error('Local presentation fixture only');
const profile = {
 id:'hallway-review', displayName:'Gold Gloves', avatarKey:'nabu', level:12,
 settings:{reducedMotion:new URLSearchParams(location.search).has('reduced'),turnTimerEnabled:true},
 savedDecks:starterRecipes.slice(0,3).map((deck,i)=>({id:`review-${i}`,name:['Corner Crew','Crashout Season','Good Vibes Only'][i],cardIds:deck.catalogCardIds,heroCardId:deck.hero,valid:true,issues:[]})),
 ownedCardIds:cardCatalog.map(card=>card.catalogId), cardProgression:{},equippedVariants:{},ownedVariants:[],
};
const bootstrap={profile,missions:[]} as unknown as PlayerBootstrap;
function Review() { const [path] = useLocation();return path.endsWith('/breakthrough') ? <BreakthroughOnline bootstrap={bootstrap}/> : <Kumite bootstrap={bootstrap}/>; }
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Review/></QueryClientProvider>);
