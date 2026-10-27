import '../src/styles/venue.css';
import '../src/pages/game/gameStyles';
/** Real Story page and emitted chapter delivery; explicitly synthetic progress and local-only dialogue receipts. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {getGetPlayerBootstrapQueryKey,getGetPlayerStoryQueryKey,type PlayerBootstrap} from '@workspace/api-client-react';
import {storyContent,storySeasons} from '@workspace/squabblemon-engine/story';
import {Router} from 'wouter';
import {memoryLocation} from 'wouter/memory-location';
import {CosmeticProvider} from '../src/components/CosmeticContext';
import {CityHeader} from '../src/components/venue/CityHeader';
import {Story} from '../src/pages/game/Story';
import '../src/index.css';
import './kumite-story-audit.fixture.css';
const scenario: string='theater';
function createBootstrap(): PlayerBootstrap {
  const timestamp = new Date(0).toISOString();
  return {
    profile: {
      id: 'season-theater-fixture-player',
      displayName: 'Theater QA',
      avatarKey: 'cornball',
      onboardingStep: 'complete',
      starterDeckId: null,
      streetRep: 68,
      xp: 400,
      level: 3,
      softCurrency: scenario === 'puzzle-complete' ? 2_540 : 2_500,
      packTickets: 3,
      styleShards: 250,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 9,
      storyNode: 2,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: timestamp,
      termsAcceptedAt: timestamp,
      settings: { reducedMotion: false, turnTimerEnabled: false },
      ownedCardIds: [],
      discoveredCardIds: [],
      ownedVariants: [],
      equippedVariants: {},
      cardProgression: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: timestamp,
    },
    missions: [],
    nextAction: {
      id: 'story',
      eyebrow: 'Season Two',
      title: 'Continue the story',
      description: 'The evidence table is waiting.',
      destination: 'story',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'fixture',
      softCurrencyCost: 200,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'street-ten-pull',
      name: 'Street Ten Pull',
      oddsVersion: 'fixture',
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 1_800,
      rewardsPerPull: 3,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}


const bootstrap=createBootstrap();
const chapter=storyContent.chapters.find(c=>c.id==='kumite-break-the-bracket')!;
let campaign={contentVersion:storyContent.version,nodes:chapter.nodes.map(n=>({chapterId:chapter.id,nodeId:n.id,title:n.title,kind:n.kind,optional:n.optional,status:'available',mapPosition:n.mapPosition,prerequisites:n.prerequisites,rewards:n.rewards,cleared:false,stars:0,attempts:0,wins:0,lastOutcome:null,dialogueSeen:[] as string[],bossHighestPhase:0,firstClearedAt:null,lastPlayedAt:null})),chapters:[{...chapter,nodes:undefined,prerequisites:undefined,status:'available',completedNodes:0,totalNodes:chapter.nodes.length,completedRequiredNodes:0,totalRequiredNodes:8,stars:0,bossStatus:'available'}],recommendedNodeId:chapter.nodes[0].id,totalStars:0,completedNodes:0,bossStatus:'in-progress',seasons:storySeasons.filter(s=>s.id==='special-kumite-break-the-bracket').map(s=>({...s,status:'available',recommendedNodeId:chapter.nodes[0].id,starsEarned:0,starsAvailable:15,clearedNodes:0,totalNodes:18}))};
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.origin);
 if(!url.pathname.startsWith('/api/'))return realFetch(input,init);
 const request=input instanceof Request?input:new Request(url,init);
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 if(request.method==='GET'&&url.pathname.endsWith('/bootstrap'))return json(bootstrap);
 if(request.method==='GET'&&url.pathname.endsWith('/story'))return json(campaign);
 const match=url.pathname.match(/\/story\/nodes\/([^/]+)\/dialogue$/);
 if(request.method==='POST'&&match){
  const body=await request.json() as {dialogueSeen?:string[]};
  campaign=structuredClone(campaign);const node=campaign.nodes.find(n=>n.nodeId===match[1]);
  if(!node)return json({error:'Unknown synthetic node'},404);
  node.dialogueSeen=[...new Set([...node.dialogueSeen,...(body.dialogueSeen??[])])];
  return json({campaign,bootstrap});
 }
 return json({error:'Local UI audit only. Live battles, rewards, purchases and puzzle submissions are disabled.'},403);
};
const memory=memoryLocation({path:'/game/story?season=special-kumite-break-the-bracket'});
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,staleTime:Infinity},mutations:{retry:false}}});
client.setQueryData(getGetPlayerBootstrapQueryKey(),bootstrap);client.setQueryData(getGetPlayerStoryQueryKey(),campaign);
function Fixture(){return <Router hook={memory.hook}><QueryClientProvider client={client}><CosmeticProvider profile={bootstrap.profile}>
 <header className="kumite-audit-controls"><strong>LOCAL STORY AUDIT · SYNTHETIC PROGRESS · NO LIVE WRITES</strong><button onClick={()=>memory.navigate('/game/story?season=special-kumite-break-the-bracket')}>Story map</button><label>Story stop<select aria-label="Story stop" defaultValue="" onChange={e=>memory.navigate('/game/story?node='+encodeURIComponent(e.target.value))}><option value="" disabled>Choose episode or manual</option>{chapter.nodes.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label></header>
 <div className="game-shell game-shell--compact-nav kumite-audit-shell"><div className="game-shell__content"><CityHeader bootstrap={bootstrap}/><div className="game-route-stage"><Story bootstrap={bootstrap}/></div></div></div>
 </CosmeticProvider></QueryClientProvider></Router>}
const root=createRoot(document.getElementById('root')!);root.render(<Fixture/>);if(import.meta.hot)import.meta.hot.dispose(()=>{root.unmount();window.fetch=realFetch;});
