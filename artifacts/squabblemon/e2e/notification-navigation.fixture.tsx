import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { profileBootstrap } from './fighter-id.fixture';
import { NotificationProvider, NotificationInbox } from '../src/components/Notifications';
import { Collection } from '../src/pages/game/Collection';
import { CharacterStyles } from '../src/pages/game/CharacterStyles';
import { Missions } from '../src/pages/game/Missions';
import { CornerStore } from '../src/pages/game/CornerStore';
import { Inventory } from '../src/pages/game/Inventory';
import { SafehouseMail } from '../src/components/SafehouseMail';
import { useNavigationScroll } from '../src/lib/navigationMemory';
import { cardCatalog } from '../src/data';
import '../src/index.css';
const profile = profileBootstrap({ id: 'notification-navigation', ownedCardIds: cardCatalog.map(c => c.catalogId), discoveredCardIds: cardCatalog.map(c => c.catalogId), unlockedCosmeticIds: ['style:kyle:stickers', 'side-alley-tagged-cardback', 'block-party-crowned', 'story-key:chapter-two', 'mastery:kyle', 'badge:after-hours', 'old-event-unlock'], ownedVariants: ['kyle:tagged'], packTickets: 3 });
profile.profile.settings.reducedMotion = true;
profile.missions = Array.from({length:20},(_,i)=>({id:`test-${i}`,title:`Specific bounty ${i}`,description:'Play the block',cadence:'daily',progress:0,goal:5,rewardCurrency:'soft',rewardAmount:50,status:'active',resetAt:'2026-09-26T00:00:00Z'})) as typeof profile.missions;
function Content() {
 const [path, navigate] = useLocation(); const search = useSearch();
 useNavigationScroll();
 return <><header style={{position:'fixed',top:0,right:0,zIndex:10000,background:'#111',padding:12}}><NotificationInbox/><button onClick={() => navigate('/game')}>Home</button></header>
 {path === '/game/collection' ? <div style={{height:'100vh'}}><Collection bootstrap={profile}/></div> : path.startsWith('/game/style/') ? <CharacterStyles bootstrap={profile} cardId={path.split('/').at(-1)}/> : path === '/game/missions' ? <Missions bootstrap={profile}/> : path === '/game/shop' ? <CornerStore bootstrap={profile}/> : path === '/game/inventory' ? <Inventory bootstrap={profile}/> : <h1>Notification test home</h1>}
 <SafehouseMail playerId={profile.profile.id} open={new URLSearchParams(search).get('notice') === 'mail'} onClose={() => navigate('/game')}/>
 </>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><NotificationProvider bootstrap={profile}><Content/></NotificationProvider></QueryClientProvider>);
