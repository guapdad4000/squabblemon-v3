import { ANUNAKI_STORY_CHAPTERS } from './anunakiStoryIds';
export { ANUNAKI_STORY_CHAPTERS } from './anunakiStoryIds';

type Reward = { kind: 'card' | 'sticker-pack' | 'player-mat' | 'deck-cover' | 'currency' | 'tickets'; id: string; label: string; artwork: string; amount?: number };
type Milestone = { id: string; title: string; chapter: number; metric: 'battles' | 'chapters' | 'stars'; target: number; requirement: string; reward: Reward; optional?: boolean };
const tablet = 'assets/anunaki-event/tablet.webp';
const clout = (id:string,amount:number):Reward => ({kind:'currency',id,label:`${amount} Clout`,amount,artwork:tablet});
const ticket = (id:string,amount:number):Reward => ({kind:'tickets',id,label:`${amount} Pack Ticket${amount === 1 ? '' : 's'}`,amount,artwork:tablet});
const sticker = (id:string,name:string):Reward => ({kind:'sticker-pack',id:`style:${id}:stickers`,label:`${name} Sticker Pack`,artwork:`assets/cosmetics/anunaki/${id}-sticker.webp`});
const cover = (id:string,name:string):Reward => ({kind:'deck-cover',id:`style:${id}:deck-cover`,label:`${name} Deck Cover`,artwork:`assets/cosmetics/anunaki/${id}-deck-cover.webp`});
/** Existing milestone IDs and v1 receipts remain stable so previously granted rewards cannot be claimed again. */
export const ANUNAKI_EVENT_MILESTONES = [
  {id:'first-contact',title:'First Contact',chapter:1,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 1: No Refunds',reward:ticket('first-contact-tickets',1)},
  {id:'yakub-mat',title:'The Scientist’s Station',chapter:1,metric:'chapters',target:1,requirement:'Complete Anunaki Chapter 1: No Refunds',reward:{kind:'player-mat',id:'player-mat:anunaki-yakub',label:'Yakub Player Mat',artwork:'assets/player-mats/v4/anunaki-yakub.webp'}},
  {id:'ancient-signal',title:'Ancient Signal',chapter:1,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in No Refunds',reward:clout('ancient-signal-clout',150)},
  {id:'time-machine-fuel',title:'Time Machine Fuel',chapter:2,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 2: Tapped In With the Ancient Text',reward:ticket('time-machine-tickets',2)},
  {id:'yakub',title:'Yakub',chapter:2,metric:'chapters',target:2,requirement:'Complete Anunaki Chapters 1 and 2',reward:{kind:'card',id:'yakub',label:'Yakub',artwork:'assets/anunaki-event/yakub.webp'}},
  {id:'laboratory-supplies',title:'Laboratory Supplies',chapter:2,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in Tapped In With the Ancient Text',reward:clout('laboratory-clout',250)},
  {id:'workshop-pass',title:'Workshop Pass',chapter:3,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 3: Instructions Not Included',reward:clout('workshop-pass-clout',100)},
  {id:'yakub-stickers',title:'Tapped In',chapter:3,metric:'chapters',target:3,requirement:'Complete Anunaki Chapters 1–3',reward:sticker('yakub','Yakub')},
  {id:'blueprint-master',title:'Read the Blueprint',chapter:3,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in Instructions Not Included',reward:cover('enki','Enki')},
  {id:'mountain-trail',title:'Heavy Footprints',chapter:4,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 4: Something Got Out',reward:clout('mountain-trail-clout',100)},
  {id:'caucus-mountaineer',title:'Caucus Mountaineer',chapter:4,metric:'chapters',target:4,requirement:'Complete Anunaki Chapters 1–4',reward:{kind:'card',id:'caucus-mountaineer',label:'Caucus Mountaineer',artwork:'assets/anunaki-event/caucus.webp'}},
  {id:'mountain-mastery',title:'No Clipboard',chapter:4,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in Something Got Out',reward:sticker('caucus-mountaineer','Caucus Mountaineer')},
  {id:'arena-pass',title:'Earn Your Introduction',chapter:5,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 5: Divine Hands',reward:cover('inanna','Inanna')},
  {id:'ancient-cache',title:'Ancient Cache',chapter:5,metric:'chapters',target:5,requirement:'Complete Anunaki Chapters 1–5',reward:ticket('ancient-cache-tickets',3)},
  {id:'storm-mastery',title:'Clear Skies',chapter:5,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in Divine Hands',reward:sticker('enlil','Enlil')},
  {id:'restoration',title:'Room to Recover',chapter:6,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 6: Life Has a Price',reward:clout('restoration-clout',100)},
  {id:'anu-mat',title:'The Sky Holds',chapter:6,metric:'chapters',target:6,requirement:'Complete Anunaki Chapters 1–6',reward:{kind:'player-mat',id:'player-mat:anunaki-anu',label:'Anu Player Mat',artwork:'assets/player-mats/v4/anunaki-anu.webp'}},
  {id:'healers-mastery',title:'Carry It Forward',chapter:6,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in Life Has a Price',reward:sticker('ninhursag','Ninhursag')},
  {id:'stabilize-the-gate',title:'The Choice to Stay',chapter:7,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 7: Wrong Place, Wrong Millennium',reward:clout('stabilize-gate-clout',100)},
  {id:'divine-reserves',title:'Divine Reserves',chapter:7,metric:'chapters',target:7,requirement:'Complete Anunaki Chapters 1–7 · Raid training opens',reward:clout('divine-reserves-clout',500)},
  {id:'gate-mastery',title:'One Timeline',chapter:7,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in Wrong Place, Wrong Millennium',reward:cover('nabu','Nabu')},
  {id:'last-charge',title:'Hold the Arrival',chapter:8,metric:'battles',target:2,requirement:'Win 2 different battles in Chapter 8: The Original Arrival',reward:clout('last-charge-clout',100)},
  {id:'anu',title:'Anu',chapter:8,metric:'chapters',target:8,requirement:'Complete all 8 Anunaki chapters · The First Arrival raid opens',reward:{kind:'card',id:'anu',label:'Anu',artwork:'assets/anunaki-event/anu.webp'}},
  {id:'anu-stickers',title:'The Arrival',chapter:8,metric:'stars',target:10,optional:true,requirement:'Optional mastery: earn 10 of 12 battle stars in The Original Arrival',reward:sticker('anu','Anu')},
] as const satisfies readonly Milestone[];
export const isAnunakiEventRewardId = (id:string):boolean => ANUNAKI_EVENT_MILESTONES.some(m=>m.reward.kind === 'card' && m.reward.id === id);
export const isAnunakiEventCatalogAvailable = (id:string,ready=ANUNAKI_EVENT_GAMEPLAY_READY):boolean => ready && isAnunakiEventRewardId(id);
export type AnunakiMilestoneId = typeof ANUNAKI_EVENT_MILESTONES[number]['id'];
export type AnunakiEventStatus = { available:boolean; reason?:string; milestones:{id:AnunakiMilestoneId;title:string;chapter:number;optional:boolean;reward:Reward;requirement:string;progress:number;target:number;state:'locked'|'ready'|'claimed';ownsReward:boolean}[] };
export const ANUNAKI_EVENT_GAMEPLAY_READY = true;
/** Eligibility is computed from this campaign only. Saved v1 claims always win over changed requirements. */
export function anunakiEventStatus(clearedBattleIds:readonly string[],completedChapterIds:readonly string[],claimedKeys:readonly string[],ownedCardIds:readonly string[],ownedCosmeticIds:readonly string[],available=ANUNAKI_EVENT_GAMEPLAY_READY,starRecords:readonly {nodeId:string;stars:number}[]=[]):AnunakiEventStatus {
  const chapters=new Set(completedChapterIds);const battles=new Set(clearedBattleIds);
  let completed=0;for(const id of ANUNAKI_STORY_CHAPTERS){if(!chapters.has(id))break;completed++;}
  return {available,...(!available?{reason:'The Anunaki cards and event are still being prepared.'}:{}),milestones:ANUNAKI_EVENT_MILESTONES.map(m=>{
    const chapterId=ANUNAKI_STORY_CHAPTERS[m.chapter-1];
    const localBattleIds=Array.from({length:4},(_,i)=>`${chapterId}-fight-${i+1}`);
    const stars=localBattleIds.reduce((total,id)=>total+Math.min(3,Math.max(0,...starRecords.filter(row=>row.nodeId===id).map(row=>row.stars))),0);
    const progress=Math.min(m.target,m.metric==='chapters'?completed:m.metric==='stars'?stars:localBattleIds.filter(id=>battles.has(id)).length);
    const reward:Reward=m.reward;const ownsReward=reward.kind==='card'?ownedCardIds.includes(reward.id):['player-mat','sticker-pack','deck-cover'].includes(reward.kind)?ownedCosmeticIds.includes(reward.id):false;
    return {id:m.id,title:m.title,chapter:m.chapter,optional:'optional' in m && m.optional,reward,requirement:m.requirement,target:m.target,progress,state:claimedKeys.includes(anunakiClaimKey(m.id))?'claimed':available&&progress>=m.target?'ready':'locked',ownsReward};
  })};
}
export const anunakiClaimKey = (id:AnunakiMilestoneId)=>`anunaki-event:arrival:${id}:v1`;
