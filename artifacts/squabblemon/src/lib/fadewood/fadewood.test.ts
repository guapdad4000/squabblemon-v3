import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StoryCampaign, StoryNodeProgress } from '@workspace/api-client-react';
import { storySeasons } from '@workspace/squabblemon-engine/storySeasons';
import { FADEWOOD_ARCS, WORLD_PLACES, getWorldActions, getWorldActionsForCampaign, getHostName, isMemorialSource, resolveContinue, resolveWorldIntent } from './registry';
import { isWorldEvent, validateWorldCheckpoint } from './contracts';
import { readStoryResume, saveStoryResume, readWorldCheckpoint, saveWorldCheckpoint } from './journey';
import tracking from './node-tracking.json';
import index from '../story/generated/index.json';
import { mailAttentionIdentity } from './mail-attention';

const values = new Map<string,string>();
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
const node=(nodeId:string,chapterId:string,extra:Partial<StoryNodeProgress>={}):StoryNodeProgress=>({nodeId,chapterId,title:nodeId,kind:'battle',optional:false,status:'available',mapPosition:{x:0,y:0},prerequisites:[],rewards:[],cleared:false,stars:0,attempts:0,wins:0,lastOutcome:null,dialogueSeen:[],bossHighestPhase:0,firstClearedAt:null,lastPlayedAt:null,...extra});
const campaign=(nodes:StoryNodeProgress[],recommendedNodeId:string|null=nodes[0]?.nodeId??null)=>({contentVersion:12,chapters:[],nodes,recommendedNodeId,totalStars:0,completedNodes:0,bossStatus:'locked'}) as StoryCampaign;

test('every installed canonical chapter has exactly one arc, without requiring Anunaki to be installed',()=>{
  for(const s of storySeasons) for(const c of s.chapterIds) assert.equal(FADEWOOD_ARCS.filter(a=>a.available&&a.chapterIds.includes(c)).length,1,c);
  assert.equal(FADEWOOD_ARCS.find(a=>a.id==='special-anunaki-arrival')?.available,false);
  assert.equal(FADEWOOD_ARCS.find(a=>a.id==='special-oz')?.hostId,'story-mural');
});
test('tracking is bound to current generated screenplay revision and covers all nodes',()=>{
  assert.equal(tracking.revision,index.revision);
  assert.deepEqual(Object.keys(tracking.nodes).sort(),index.chapters.flatMap(c=>c.nodes.map(n=>n.id)).sort());
});
test('Continue retains the saved arc while the global recommendation points elsewhere',()=>{
  values.clear();saveStoryResume('a','red','season-1');
  const c=campaign([node('red','red-side-tapes'),node('sherlock','special-sherlock-missing-motion')],'sherlock');
  assert.equal(resolveContinue(c,'a')?.node.nodeId,'red');
  assert.equal(resolveContinue(c,'a','special-sherlock')?.node.nodeId,'sherlock');
});
test('completed saved node advances within its arc, instead of replaying or switching arcs',()=>{
  values.clear();saveStoryResume('a','done','season-1');
  const c=campaign([node('done','block-party',{cleared:true,status:'cleared'}),node('next','red-side-tapes'),node('other','special-sherlock-missing-motion')],'other');
  assert.equal(resolveContinue(c,'a')?.node.nodeId,'next');
});
test('saved cleared fight resumes unread post-dialogue and then advances after those receipts exist',()=>{
  values.clear();saveStoryResume('a','welcome-to-the-block','season-1');
  const m=tracking.nodes['welcome-to-the-block'];assert.ok(m.post>0);
  const n=node('welcome-to-the-block','block-party',{cleared:true,status:'cleared'});
  const c=campaign([n,node('next','red-side-tapes')],'next');
  assert.equal(resolveContinue(c,'a')?.node.nodeId,n.nodeId);
  n.dialogueSeen=Array.from({length:m.post},(_,i)=>`${m.token}:post:${i}`);
  assert.equal(resolveContinue(c,'a')?.node.nodeId,'next');
});
test('locked nodes, absent expansion and account boundaries cannot be bypassed by resume storage',()=>{
  values.clear();saveStoryResume('a','locked','season-1');
  const c=campaign([node('locked','block-party',{status:'locked'}),node('available','special-sherlock-missing-motion')]);
  assert.equal(resolveContinue(c,'a')?.node.nodeId,'available');assert.equal(readStoryResume('b'),null);
  assert.equal(resolveContinue(c,'a','special-anunaki-arrival'),null);
});
test('world sources only resolve their allowed semantic actions, never arbitrary URLs or lookalike encounters',()=>{
  assert.deepEqual(resolveWorldIntent('mailman','mail'),{kind:'mail'});
  assert.deepEqual(resolveWorldIntent('fade-park-bulletin','events'),{kind:'mode',route:'/game/events'});
  assert.deepEqual(resolveWorldIntent('fade-park-bulletin','bounties'),{kind:'mode',route:'/game/missions'});
  assert.equal(resolveWorldIntent('fade-park-bulletin','/game/admin'),null);
  assert.equal(resolveWorldIntent('og-blue','blueWelcome'),null);
  assert.equal(resolveWorldIntent('blue-yb','blueWelcome'),null);
  assert.equal(resolveWorldIntent('mailman','/game/admin/patches'),null);
  assert.equal(resolveWorldIntent('__proto__','market'),null);
  assert.deepEqual(resolveWorldIntent('officer-oinkston','patrol'),{kind:'mode',route:'/game/challenges?game=punch-on-patrol'});
});
test('active character menus follow their current arc while keeping venue actions and lock boundaries',()=>{
  values.clear();
  const c=campaign([node('s2-the-morning-after-opening','s2-the-morning-after'),node('sherlock-three-bad-alibis','special-sherlock-missing-motion')]);
  const cornball=getWorldActionsForCampaign('cornball',c,'a','season-2');
  assert.equal(cornball[0].id,'season-2');
  assert.ok(cornball.some(action=>action.id==='market'));
  assert.ok(getWorldActionsForCampaign('snitch',c,'a','special-sherlock').some(action=>action.id==='special-sherlock'));
  assert.equal(getWorldActionsForCampaign('og-blue',c,'a','season-2').some(action=>action.id==='season-2'),false);
  assert.equal(getWorldActionsForCampaign('__proto__',c,'a','season-2').length,0);
  c.nodes[1].status='locked';
  assert.equal(getWorldActionsForCampaign('snitch',c,'a').some(action=>action.id==='special-sherlock'),false);
});
test('Nova remains a memorial with no routes or dynamic Story actions, distinct from the other dog',()=>{
  const c=campaign([node('welcome-to-the-block','block-party'),node('s2-the-morning-after-opening','s2-the-morning-after')]);
  assert.equal(isMemorialSource('nova'),true);
  assert.equal(getHostName('nova'),'Nova');
  assert.deepEqual(getWorldActions('nova'),[]);
  assert.deepEqual(getWorldActionsForCampaign('nova',c,'a','season-1'),[]);
  for(const id of [undefined,'safehouse','friends','mail','market','season-1','/game']) assert.equal(resolveWorldIntent('nova',id),null);
  assert.equal(isMemorialSource('golden-doberman'),false);
});
test('DeMario and Luigion have a reachable contextual booth without a fictional chapter or commerce route',()=>{
  const sourceId='demario-luigion-booth';
  assert.equal(getHostName(sourceId),'DeMario & Luigion');
  assert.equal(WORLD_PLACES.find(place=>place.id===sourceId)?.note,'Smoke shop · Chapter in development');
  assert.deepEqual(getWorldActionsForCampaign(sourceId,campaign([node('welcome-to-the-block','block-party')]),'a'),[]);
  for(const id of [undefined,'market','shop','season-1','special-demario-luigion']) assert.equal(resolveWorldIntent(sourceId,id),null);
  assert.equal(FADEWOOD_ARCS.some(arc=>arc.id==='special-demario-luigion'),false);
});
test('world bridge rejects wrong instance, invalid coordinates and unsupported messages',()=>{
  const base={channel:'squabblemon-fadewood',version:1,instanceId:'a'};
  assert.ok(isWorldEvent({...base,type:'ready'},'a'));
  assert.ok(isWorldEvent({...base,type:'focusComplete',requestId:'visit-1',sourceId:'cornball'},'a'));
  assert.equal(isWorldEvent({...base,type:'focusComplete',requestId:'',sourceId:'cornball'},'a'),false);
  assert.equal(isWorldEvent({...base,type:'focusCancelled',requestId:'visit-1',sourceId:'cornball',reason:'grant-reward'},'a'),false);
  assert.ok(isWorldEvent({...base,type:'lighting',night:true,requestedNight:true,status:'ready'},'a'));
  assert.equal(isWorldEvent({...base,type:'lighting',night:'false',requestedNight:false,status:'ready'},'a'),false);
  assert.equal(isWorldEvent({...base,type:'lighting',night:false,requestedNight:true,status:'grant-reward'},'a'),false);
  assert.equal(isWorldEvent({...base,type:'ready'},'b'),false);
  assert.equal(isWorldEvent({...base,type:'completeStory',nodeId:'welcome-to-the-block'},'a'),false);
  assert.equal(validateWorldCheckpoint({position:[Infinity,0,0],yaw:0}),false);
  assert.equal(validateWorldCheckpoint({position:[0,0,2000],yaw:0}),false);
  assert.equal(isWorldEvent({...base,type:'state',playing:true,travel:false,checkpoint:{position:[0,.2,24],yaw:0},markers:[{arcId:'x',sourceId:'x',label:'x',x:101,y:0,visible:true}]},'a'),false);
});
test('world checkpoints are account-scoped presentation only and malformed storage is recoverable',()=>{
  values.clear();saveWorldCheckpoint('a',{position:[0,.2,24],yaw:1});
  assert.equal(readWorldCheckpoint('b'),null);assert.deepEqual(readWorldCheckpoint('a')?.position,[0,.2,24]);
  values.set('squabblemon:fadewood:v1:a:checkpoint','broken');assert.equal(readWorldCheckpoint('a'),null);
});

test('courier attention is bounded, account-specific and stable across harmless mail query refreshes',()=>{
  const gift={softCurrency:25};
  const first={id:'newsletter',readAt:null,claimedAt:null,gift};
  const second={id:'event',readAt:null,claimedAt:null,gift:{softCurrency:0}};
  const id=mailAttentionIdentity('account-a',[first,second]);
  assert.ok(id.length>0&&id.length<=240);
  assert.equal(mailAttentionIdentity('account-a',[structuredClone(second),structuredClone(first)]),id);
  assert.notEqual(mailAttentionIdentity('account-b',[first,second]),id);
  assert.notEqual(mailAttentionIdentity('account-a',[first,{...second,id:'new-event'}]),id);
  assert.notEqual(mailAttentionIdentity('account-a',[{...first,readAt:'read'},second]),id);
  assert.equal(mailAttentionIdentity('account-a',[{...first,readAt:'read',claimedAt:'claimed'}]),'');
});
