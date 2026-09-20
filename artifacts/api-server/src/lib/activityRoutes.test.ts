import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {draftOffers,eventWeek} from '@workspace/squabblemon-engine/activities';
import {ROOKIE_CORE_IDS,catalogIdsToEngineIds} from '@workspace/squabblemon-engine/data';
import {createStoryMatch, playTurnCard, pass, revealCpuTurn, nextRound, canAffordSelection, getDistrictResults, getMatchWinner, type Match, type Lane, type PlayerMove} from '@workspace/squabblemon-engine/gameEngine';

// Vary only legal player choices. The server still replays every move against
// its database-issued snapshots; no result or progress is injected.
function winningStoryMoves(initial: Match) {
 for (let attempt=0; attempt<40; attempt++) {
  let match=initial, seed=attempt+1; const moves: PlayerMove[]=[];
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  while(match.phase!=='complete') {
   for(let play=0;play<7;play++) {
    const options=match.playerHand.flatMap(card=>([0,1,2] as Lane[]).filter(lane=>canAffordSelection(match,'player',card.instanceId,lane)).map(lane=>{
     const after=playTurnCard(match,'player',card.instanceId,lane);
     const score=getDistrictResults(after).reduce((n,d)=>n+(d.winner==='player'?12:d.winner==='cpu'?-12:0)+12*(d.player-d.cpu)/(4+Math.abs(d.player-d.cpu)),0)+random()*attempt;
     return {card,lane,after,score};
    })).sort((a,b)=>b.score-a.score);
    if(!options.length)break;
    const best=options[0];moves.push({cardInstanceId:best.card.instanceId,lane:best.lane,squabble:false,endTurn:false});match=best.after;
   }
   moves.push({cardInstanceId:null,lane:null,squabble:false,endTurn:true});match=nextRound(revealCpuTurn(pass(match,'player')));
  }
  if(getMatchWinner(match)==='player')return moves;
 }
 throw new Error('Could not find a legal winning fixture');
}

test('real activity routes validate drafts, normalize combat, replay events and credit once', {skip:!process.env.DATABASE_URL}, async t=>{
 const {default:express}=await import('express');
 const {db,pool,playerProfilesTable}=await import('@workspace/db');
 const {eq}=await import('drizzle-orm');
 const {ensurePlayer}=await import('./playerState');
 const {default:router}=await import('../routes/player');
 const {default:collectionRouter}=await import('../routes/collection');
 const userId=`activity-http-${randomUUID()}`;
 const savedDeckId=randomUUID(); // The crew builder creates 36-character IDs.
 await ensurePlayer(userId);
 await db.update(playerProfilesTable).set({onboardingStep:'complete',ownedCardIds:[...ROOKIE_CORE_IDS],cardProgression:{cornball:{xp:2800,level:8,moveTier:3}},savedDecks:[{id:'custom',name:'My Gang',cardIds:[...ROOKIE_CORE_IDS],heroCardId:'hooper'}]}).where(eq(playerProfilesTable.clerkUserId,userId));
 const app=express();app.use(express.json());
 // Test-only authenticated session; production middleware is never modified.
 app.use((req,_res,next)=>{(req as any).auth=Object.assign(()=>({userId,sessionId:'test',tokenType:'session_token',isAuthenticated:true}),{[Symbol.for('@clerk/express.auth')]:true});(req as any).log={warn(data:any){console.log(data.error?.message)},error(){}};next();});
 app.use('/api',router,collectionRouter);app.use((error:Error,_req:any,res:any,_next:any)=>res.status(500).json({error:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const address=server.address() as {port:number};const origin=`http://127.0.0.1:${address.port}/api`;
 t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));await pool.end();});
 const post=async(path:string,body:unknown,method='POST')=>{const res=await fetch(origin+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await res.json() as any;if(res.status===500)throw new Error(JSON.stringify(result));return {status:res.status,body:result};};
 const start={mode:'practice',playerDeckId:savedDeckId,rivalDeckId:'block'};
 // Exercise the real save -> match boundary, including old short IDs and the
 // longest supported saved ID. Matching must never truncate a crew's identity.
 assert.equal((await post('/player/matches',{...start,playerDeckId:'custom'})).status,201);
 for(const id of [savedDeckId,'saved-'.padEnd(80,'x')]) {
  const saved=await post(`/player/decks/${id}`,{name:'Custom Gang',cardIds:[...ROOKIE_CORE_IDS],heroCardId:'hooper',recipeId:null},'PUT');
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert(saved.body.profile.savedDecks.some((deck:any)=>deck.id===id));
  const started=await post('/player/matches',{...start,playerDeckId:id});
  assert.equal(started.status,201,JSON.stringify(started.body));
  assert.equal(started.body.playerDeckId,id);
  assert.deepEqual(started.body.abilityUpgradeSnapshot.player.map((card:any)=>card.cardId),catalogIdsToEngineIds(ROOKIE_CORE_IDS));
 }
 const missing=await post('/player/matches',{...start,playerDeckId:randomUUID()});
 assert.equal(missing.status,400);assert.equal(missing.body.error,'Unknown player deck');
 assert.equal((await post('/player/matches',{...start,playerDeckId:'x'.repeat(81)})).status,400);
 assert.equal((await post('/player/matches',{...start,activity:'invented'})).status,400);
 assert.equal((await post('/player/matches',{...start,activity:'draft',draftWeek:eventWeek(),draftPicks:Array(7).fill('cornball')})).status,400);
 const fair=await post('/player/matches',{...start,activity:'fair'});
 assert.equal(fair.status,201,JSON.stringify(fair.body));assert.equal(fair.body.encounterSnapshot.activity.normalized,true);
 assert(fair.body.abilityUpgradeSnapshot.player.every((c:any)=>c.level===1&&c.upgradeIds.length===0));
 const moves=Array.from({length:6},()=>({cardInstanceId:null,lane:null,squabble:false,endTurn:true}));
 const legacyMoves=moves.map(({endTurn,...move})=>move);
 assert.equal((await post(`/player/matches/${fair.body.id}/complete`,{moves:legacyMoves})).status,400);
 const first=await post(`/player/matches/${fair.body.id}/complete`,{moves});assert.equal(first.status,200,JSON.stringify(first.body));
 const second=await post(`/player/matches/${fair.body.id}/complete`,{moves});assert.equal(second.status,200);assert.equal(second.body.alreadyCompleted,true);assert.equal(first.body.profile.softCurrency,second.body.profile.softCurrency);
 const picks=draftOffers(eventWeek()).map(o=>o[0]);
 const draft=await post('/player/matches',{...start,playerDeckId:'street-draft',activity:'draft',draftWeek:eventWeek(),draftPicks:picks});
 assert.equal(draft.status,201,JSON.stringify(draft.body));assert.deepEqual(draft.body.abilityUpgradeSnapshot.player.map((c:any)=>c.cardId),picks);
 const ended=await post(`/player/matches/${draft.body.id}/complete`,{moves});assert.equal(ended.status,200,JSON.stringify(ended.body));
 assert.deepEqual(ended.body.profile.ownedCardIds.sort(),[...ROOKIE_CORE_IDS].sort());
 const normal=await post('/player/matches',{...start,activity:'auto'});assert.equal(normal.status,201);
 assert.equal(normal.body.abilityUpgradeSnapshot.player.find((c:any)=>c.cardId==='cornball').upgradeIds.length,3);
 assert.notEqual(normal.body.rivalDeckId,draft.body.rivalDeckId);
 const boss=await post('/player/matches',{...start,activity:'boss'});assert.equal(boss.status,201);
 assert.equal((await post(`/player/matches/${boss.body.id}/complete`,{moves})).status,200);
 await db.update(playerProfilesTable).set({cardProgression:Object.fromEntries(catalogIdsToEngineIds(ROOKIE_CORE_IDS).map(id=>[id,{xp:2800,level:8,moveTier:3}]))}).where(eq(playerProfilesTable.clerkUserId,userId));
 const story=await post('/player/matches',{mode:'story',playerDeckId:savedDeckId,rivalDeckId:'block',storyNodeId:'welcome-to-the-block'});
 assert.equal(story.status,201,JSON.stringify(story.body));
 assert.equal(story.body.playerDeckId,savedDeckId);
 const storyMatch=createStoryMatch(story.body.encounterSnapshot,catalogIdsToEngineIds(ROOKIE_CORE_IDS),savedDeckId,story.body.abilityUpgradeSnapshot,story.body.districtSnapshot);
 const winningMoves=winningStoryMoves(storyMatch);
 const cleared=await post(`/player/matches/${story.body.id}/complete`,{moves:winningMoves});
 assert.equal(cleared.status,200,JSON.stringify(cleared.body));
 assert.equal(cleared.body.campaign.nodes.find((n:any)=>n.nodeId==='welcome-to-the-block').status,'cleared');
 assert.equal(cleared.body.campaign.nodes.find((n:any)=>n.nodeId==='blue-side-pressure').status,'available');
 const retried=await post(`/player/matches/${story.body.id}/complete`,{moves:winningMoves});
 assert.equal(retried.status,200);assert.equal(retried.body.alreadyCompleted,true);
 assert.equal(retried.body.profile.softCurrency,cleared.body.profile.softCurrency);
});
