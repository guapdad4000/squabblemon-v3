import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import type {RequestHandler} from 'express';
import {eq} from 'drizzle-orm';
import {db,playerProfilesTable,playerStoryNodesTable} from '@workspace/db';
import {ROOKIE_FOUNDATION_IDS,ROOKIE_MENTOR_CORE_IDS,catalogIdsToEngineIds,catalogCardByEngineId} from '@workspace/squabblemon-engine/data';
import {storyContent,isStoryPuzzleSolution,storyDialogueToken} from '@workspace/squabblemon-engine/story';
import {ANUNAKI_STORY_CHAPTERS} from '@workspace/squabblemon-engine/anunakiEvent';
import {createStoryMatch,getMatchWinner,verifyStoryMatchTranscript,type TranscriptMove} from '@workspace/squabblemon-engine/gameEngine';
import {solveStoryMoves} from './storyMoveSolver';
import {createApp} from '../app';

/** Local native database + authenticated HTTP. The solver plays legal, replay-verified battles; no winner/state is forged. */
test('fresh foundation account plays all 56 Anunaki nodes, earns Yakub/Caucus/Anu and opens the raid through authenticated HTTP',{timeout:600000},async t=>{
  const userId=`anunaki-complete-journey-${randomUUID()}`;
  const deckId='anunaki-story-owned-crew';
  let catalogCrew=[...ROOKIE_MENTOR_CORE_IDS];
  await db.insert(playerProfilesTable).values({clerkUserId:userId,onboardingStep:'complete',tutorialCompleted:true,starterRewardClaimed:true,ownedCardIds:[...ROOKIE_FOUNDATION_IDS],discoveredCardIds:[...ROOKIE_FOUNDATION_IDS],softCurrency:0,packTickets:0,savedDecks:[{id:deckId,name:'Foundation Story Crew',cardIds:catalogCrew,heroCardId:catalogCrew[0],recipeId:null}]});
  t.after(async()=>{await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));});
  const auth:RequestHandler=(req,_res,next)=>{const auth=()=>({userId,sessionId:'local-journey',tokenType:'session_token',isAuthenticated:true});Object.assign(auth,{[Symbol.for('@clerk/express.auth')]:true});Object.assign(req,{auth});next();};
  const server=createApp(auth).listen(0,'127.0.0.1');
  await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  t.after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function request(path:string,body?:unknown,expected=[200]) {const response=await fetch(base+path,body===undefined?undefined:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const json=await response.json() as any;assert(expected.includes(response.status),`${path}: HTTP ${response.status} ${JSON.stringify(json)}`);return json;}
  let campaign=await request('/player/story');
  assert.equal(campaign.chapters.find((chapter:any)=>chapter.id===ANUNAKI_STORY_CHAPTERS[0]).status,'available');
  await request('/player/rewards/anunaki-event/claim',{milestoneId:'yakub'},[409]);
  await request('/player/story/nodes/'+ANUNAKI_STORY_CHAPTERS[1]+'-arrival/complete',{idempotencyKey:randomUUID(),dialogueSeen:[]},[409]);
  const completedBattleIds:string[]=[];
  const cases:{nodeId:string;winner:string;actions:number;crew:string[]}[]=[];
  for(const [chapterIndex,chapterId] of ANUNAKI_STORY_CHAPTERS.entries()){
    const chapter=storyContent.chapters.find(chapter=>chapter.id===chapterId)!;
    for(const node of chapter.nodes){
      const key=randomUUID();
      if(node.kind==='battle'){
        const issued=await request('/player/matches',{mode:'story',playerDeckId:deckId,rivalDeckId:'slide',storyNodeId:node.id},[201]);
        const engineCrew=catalogIdsToEngineIds(catalogCrew);
        const initial=createStoryMatch(issued.encounterSnapshot,engineCrew,deckId,issued.abilityUpgradeSnapshot,issued.districtSnapshot);
        const moves=solveStoryMoves(initial,'win',64) as TranscriptMove[];
        const verified=verifyStoryMatchTranscript(issued.encounterSnapshot,engineCrew,moves,deckId,issued.abilityUpgradeSnapshot,issued.districtSnapshot);
        assert.equal(getMatchWinner(verified),'player',node.id);
        const complete=await request(`/player/matches/${issued.id}/complete`,{moves});
        const retry=await request(`/player/matches/${issued.id}/complete`,{moves});
        assert.equal(retry.profile.packTickets,complete.profile.packTickets,`${node.id} retry preserves tickets`);
        completedBattleIds.push(node.id);cases.push({nodeId:node.id,winner:'player',actions:moves.length,crew:[...catalogCrew]});
        t.diagnostic(`${completedBattleIds.length}/32: ${node.id}, legal replay-verified win (${moves.length} actions)`);
      }else{
        const seen=node.scenes.map((_,index)=>storyDialogueToken(node.id,'main',index));
        const path=node.puzzle?'/player/story/puzzle':`/player/story/nodes/${node.id}/complete`;
        if(node.puzzle){assert(isStoryPuzzleSolution(node.puzzle,node.puzzle.solution));await request(path,{nodeId:node.id,idempotencyKey:randomUUID(),order:[...node.puzzle.solution].reverse(),dialogueSeen:seen},[400]);}
        const body=node.puzzle?{nodeId:node.id,idempotencyKey:key,order:[...node.puzzle.solution],dialogueSeen:seen}:{idempotencyKey:key,dialogueSeen:seen};
        const first=await request(path,body);const retry=await request(path,body);
        assert.equal(retry.alreadyCompleted,true);
        assert.equal(retry.bootstrap.profile.packTickets,first.bootstrap.profile.packTickets);
      }
      // Re-read authoritative progress as a resumed client would, instead of trusting client node state.
      campaign=await request('/player/story');
      assert.equal(campaign.nodes.find((progress:any)=>progress.nodeId===node.id).cleared,true,node.id);
    }
    assert.equal(campaign.chapters.find((chapter:any)=>chapter.id===chapterId).status,'cleared');
    const rewardId=chapterIndex===1?'yakub':chapterIndex===3?'caucus-mountaineer':chapterIndex===7?'anu':null;
    if(rewardId){await request('/player/rewards/anunaki-event/claim',{milestoneId:rewardId});const retry=await request('/player/rewards/anunaki-event/claim',{milestoneId:rewardId});assert.equal(retry.claimed,false);assert(retry.bootstrap.profile.ownedCardIds.includes(rewardId));
      if(chapterIndex<7){const engineId=catalogCardByEngineId[rewardId].catalogId;catalogCrew=[...catalogCrew.slice(0,9),engineId];await db.update(playerProfilesTable).set({savedDecks:[{id:deckId,name:'Earned Story Crew',cardIds:catalogCrew,heroCardId:catalogCrew[0],recipeId:null}]}).where(eq(playerProfilesTable.clerkUserId,userId));}
    }
    if(chapterIndex<1)await request('/player/rewards/anunaki-event/claim',{milestoneId:'yakub'},[409]);
    if(chapterIndex<3)await request('/player/rewards/anunaki-event/claim',{milestoneId:'caucus-mountaineer'},[409]);
    if(chapterIndex<7)await request('/player/rewards/anunaki-event/claim',{milestoneId:'anu'},[409]);
  }
  assert.equal(completedBattleIds.length,32);
  const final=await request('/player/story');assert.equal(final.seasons.find((season:any)=>season.id==='special-anunaki-arrival').status,'cleared');
  const raid=await request('/player/anunaki-raid');
  assert.equal(raid.eligibility.standard,true,JSON.stringify(raid));
  const rows=await db.select().from(playerStoryNodesTable).where(eq(playerStoryNodesTable.clerkUserId,userId));
  assert.equal(rows.filter(row=>row.cleared&&row.chapterId.startsWith('anunaki-')).length,56);
  t.diagnostic(JSON.stringify({evidence:'isolated native PostgreSQL + local authenticated HTTP + bounded solver, not human play',battles:cases}));
});
