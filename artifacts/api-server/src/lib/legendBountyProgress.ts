import {and,eq} from 'drizzle-orm';
import {db,playerCollectionClaimsTable,type PlayerProfileRecord} from '@workspace/db';
import {legendBountyStatuses,advanceBountyCounters,type BountyTask} from '@workspace/squabblemon-engine/legendBounties';
import {battleAchievements} from '@workspace/squabblemon-engine/insights';
import {cards} from '@workspace/squabblemon-engine/data';
import type {Match} from '@workspace/squabblemon-engine/gameEngine';
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Caller holds the profile lock. Immutable event receipt prevents replay after a node changes. */
export async function progressBountyEvent(tx:Tx,profile:PlayerProfileRecord,eventId:string,tasks:readonly BountyTask[]){
 const key=`legend-event:${eventId}`;
 const [seen]=await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId,profile.clerkUserId),eq(playerCollectionClaimsTable.milestoneKey,key)));
 if(seen)return profile.storyProgress;
 const receipts=await tx.select({key:playerCollectionClaimsTable.milestoneKey}).from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId,profile.clerkUserId));
 const statuses=legendBountyStatuses(null,[],profile.ownedCardIds,receipts.map(r=>r.key),profile.storyProgress.bountyCampaign);
 const counters=advanceBountyCounters(statuses,profile.storyProgress.bountyCampaign,tasks);
 await tx.insert(playerCollectionClaimsTable).values({clerkUserId:profile.clerkUserId,milestoneKey:key,reward:{}});
 const date=new Date().toISOString().slice(0,10);
 const old=profile.storyProgress.growthDaily as {date?:string;counters?:Record<string,number>}|undefined;
 const dailyCounters={...(old?.date===date?old.counters:{})};
 for(const task of tasks)dailyCounters[task]=Math.min(99,(dailyCounters[task]??0)+1);
 return {...profile.storyProgress,bountyCampaign:counters,growthDaily:{date,counters:dailyCounters}};
}
export function standardBountyTasks(match:Match,mode:string,outcome:string,districtsWon:number,challenge:boolean):BountyTask[]{
 if(mode==='tutorial')return [];
 const tasks:BountyTask[]=[];const win=outcome==='win';const facts=battleAchievements(match);
 if(mode==='practice'&&!challenge){tasks.push('training');if(win)tasks.push('training-win');}
 if(mode==='story'&&!challenge&&win)tasks.push('story-win');
 if(challenge&&win)tasks.push('challenge-win');
 if(facts.cleansed)tasks.push('cleanse');if(facts.movementWin&&win)tasks.push('movement-win');
 if(win){if(districtsWon===3)tasks.push('sweep-win');if(facts.playedIds.some(id=>cards[id]?.type==='Fire'))tasks.push('fire-win');if(facts.playedIds.some(id=>cards[id]?.roles?.includes('Support')))tasks.push('support-win');
 const kind=match.storyEncounter?.activity?.kind;if(kind==='boss')tasks.push('boss-win');if(kind==='draft')tasks.push('draft-win');if(kind==='neighborhood')tasks.push('neighborhood-win');}
 return tasks;
}
