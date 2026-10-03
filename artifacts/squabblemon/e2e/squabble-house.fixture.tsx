import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, getGetPlayerStoryQueryKey, type StoryCampaign } from '@workspace/api-client-react';
import { storyContent, storyDialogueToken, storySeasons } from '@workspace/squabblemon-engine/story';
import { Router } from 'wouter';
import { CityHeader } from '../src/components/venue/CityHeader';
import { CosmeticProvider } from '../src/components/CosmeticContext';
import { RewardReveal } from '../src/components/RewardReveal';
import { Story } from '../src/pages/game/Story';
import { createBootstrap } from './squabble-house-bootstrap';
import '../src/index.css';
import '../src/styles/venue.css';

// Local UI review only. Mutations are intercepted here; production authority remains server-side.
const params = new URLSearchParams(location.search);
const chapterNumber = Math.min(6,Math.max(1,Number(params.get('chapter') || 1)));
const view = params.get('view') || 'movie';
const house = storyContent.chapters.filter(c=>c.id.startsWith('squabble-house-'));
const chapter = house[chapterNumber-1];
const targetIndex = view === 'puzzle' ? 1 : view === 'battle' ? 2 : view === 'reward' ? 3 : 0;
const target = chapter.nodes[targetIndex];
let bootstrap = createBootstrap();
const progress = new Map<string,{cleared:boolean;seen:string[]}>();
for(const [i,c] of house.entries()) for(const [j,n] of c.nodes.entries()) {
  const cleared = i < chapterNumber-1 || (i===chapterNumber-1 && j<targetIndex);
  progress.set(n.id,{cleared,seen:((view==='puzzle'||view==='battle') && n.id===target.id)
    ? (n.kind==='battle' ? n.preDialogue : n.scenes).map((_,i)=>storyDialogueToken(n.id,n.kind==='battle'?'pre':'main',i)) : []});
}
function createCampaign(): StoryCampaign {
 const clearedChapters=new Set(storyContent.chapters.filter(c=>c.nodes.every(n=>progress.get(n.id)?.cleared)).map(c=>c.id));
 const nodes=storyContent.chapters.flatMap(c=>c.nodes.map(n=>{
   const saved=progress.get(n.id); const cleared=!!saved?.cleared;
   const available=c.prerequisites.every(id=>clearedChapters.has(id))&&n.prerequisites.every(id=>progress.get(id)?.cleared);
   return {chapterId:c.id,nodeId:n.id,title:n.title,kind:n.kind,optional:n.optional,
    status:cleared?'cleared' as const:available?'available' as const:'locked' as const,mapPosition:{...n.mapPosition},prerequisites:[...n.prerequisites],rewards:structuredClone(n.rewards),cleared,stars:cleared&&n.kind==='battle'?3:0,attempts:0,wins:cleared&&n.kind==='battle'?1:0,lastOutcome:cleared?'win':null,dialogueSeen:saved?.seen??[],bossHighestPhase:0,firstClearedAt:cleared?new Date(0):null,lastPlayedAt:null};
 }));
 const chapters=storyContent.chapters.map(c=>{const ns=nodes.filter(n=>n.chapterId===c.id);const done=ns.filter(n=>n.cleared).length;return {id:c.id,title:c.title,subtitle:c.subtitle,description:c.description,order:c.order,mapAssetId:c.mapAssetId,status:done===ns.length?'cleared' as const:ns.some(n=>n.status==='available')?'available' as const:'locked' as const,completedNodes:done,totalNodes:ns.length,completedRequiredNodes:done,totalRequiredNodes:ns.length,stars:ns.reduce((a,n)=>a+n.stars,0),bossStatus:'available'};});
 const recommendedNodeId=nodes.find(n=>n.chapterId===chapter.id&&n.status==='available')?.nodeId??null;
 return {contentVersion:storyContent.version,chapters,nodes,recommendedNodeId,totalStars:nodes.reduce((a,n)=>a+n.stars,0),completedNodes:nodes.filter(n=>n.cleared).length,bossStatus:'in-progress',seasons:storySeasons.map(s=>{const ns=nodes.filter(n=>s.chapterIds.includes(n.chapterId));return {...s,chapterIds:[...s.chapterIds],status:ns.every(n=>n.cleared)?'cleared' as const:ns.some(n=>n.status==='available')?'available' as const:'locked' as const,recommendedNodeId:ns.find(n=>n.status==='available')?.nodeId??null,starsEarned:ns.reduce((a,n)=>a+n.stars,0),starsAvailable:ns.filter(n=>n.kind==='battle').length*3,clearedNodes:ns.filter(n=>n.cleared).length,totalNodes:ns.length};})};
}
let campaign=createCampaign();
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const request=input instanceof Request?input:new Request(input,init);const path=new URL(request.url,location.origin).pathname;
 if(!path.startsWith('/api/player/'))return originalFetch(input,init);
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 if(request.method==='GET')return json(path.endsWith('/story')?campaign:bootstrap);
 const body=await request.json(); const nodeId=decodeURIComponent(path.match(/\/nodes\/([^/]+)/)?.[1]??body.nodeId??'');
 const node=storyContent.chapters.flatMap(c=>c.nodes).find(n=>n.id===nodeId);
 if(!node)return json({error:'Unknown fixture node'},404);
 const saved=progress.get(nodeId)??{cleared:false,seen:[]};saved.seen=[...new Set([...saved.seen,...(body.dialogueSeen??[])])] as string[];
 const complete=path.endsWith('/complete')||path.endsWith('/puzzle');
 if(complete)saved.cleared=true;
 progress.set(nodeId,saved);campaign=createCampaign();
 return json({campaign,bootstrap,rewards:complete?node.rewards:[],alreadyCompleted:false});
};
const url=new URLSearchParams();if(view!=='theater')url.set('season','special-squabble-house');if(!['map','theater'].includes(view))url.set('node',target.id);
window.localStorage.setItem('squabblemon_e2e_user','signed-in');
window.history.replaceState({},'',`${import.meta.env.BASE_URL.replace(/\/$/,'')}/game/story?${url}`);
const style=document.createElement('style');style.textContent='#replit-dev-banner{display:none!important}';document.head.append(style);
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
client.setQueryData(getGetPlayerBootstrapQueryKey(),bootstrap);client.setQueryData(getGetPlayerStoryQueryKey(),campaign);
createRoot(document.getElementById('root')!).render(<Router base={import.meta.env.BASE_URL.replace(/\/$/,'')}><QueryClientProvider client={client}><CosmeticProvider profile={bootstrap.profile}><RewardReveal/><div className="game-shell game-shell--compact-nav h-[100dvh] bg-[#070707] text-white"><div className="game-shell__content"><CityHeader bootstrap={bootstrap}/><div className="game-route-stage"><Story bootstrap={bootstrap}/></div></div></div></CosmeticProvider></QueryClientProvider></Router>);
