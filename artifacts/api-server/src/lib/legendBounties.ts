import { eq } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable } from '@workspace/db';
import { LEGEND_BOUNTIES, legendBountyKey, legendNodeKey, legendBountyStatuses } from '@workspace/squabblemon-engine/legendBounties';
import { lockPlayerProfile, PlayerRewardError } from './playerRewardTransactions';
async function read(reader:Pick<typeof db,'select'>, userId:string) {
 const [profile]=await reader.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId));
 if(!profile) throw new PlayerRewardError('Player profile not found',404);
 const receipts=await reader.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId,userId));
 return {profile,receipts,statuses:legendBountyStatuses(null,[],profile.ownedCardIds,receipts.map(r=>r.milestoneKey),profile.storyProgress.bountyCampaign)};
}
export async function getLegendBounties(userId:string){return (await read(db,userId)).statuses;}
export async function claimLegendBounty(userId:string,id:string,nodeId?:string){
 const definition=LEGEND_BOUNTIES.find(b=>b.id===id);
 if(!definition) throw new PlayerRewardError('Unknown legend bounty',404);
 const requested=nodeId??definition.nodes[2].id;
 if(!definition.nodes.some(n=>n.id===requested))throw new PlayerRewardError('Unknown bounty node',404);
 return db.transaction(async tx=>{
 await lockPlayerProfile(tx,userId);
 const {profile,receipts,statuses}=await read(tx,userId);const status=statuses.find(b=>b.id===id)!;
 const n=status.nodes.find(n=>n.id===requested)!;const key=legendNodeKey(id,n.id);
 if(status.state==='claimed'||receipts.some(r=>r.milestoneKey===key))return {claimed:false,duplicateShards:0,unlocked:false,nodeId:n.id,reward:n.reward};
 if(status.gate)throw new PlayerRewardError(status.gate,409);
 if(n.state!=='ready'||status.currentNodeId!==n.id)throw new PlayerRewardError(n.description,409);
 const final=n.id===definition.nodes[2].id;
 const duplicateShards=final&&status.ownsCard?25:0;
 const ownedCardIds=final?[...new Set([...profile.ownedCardIds,id])]:profile.ownedCardIds;
 await tx.insert(playerCollectionClaimsTable).values({clerkUserId:userId,milestoneKey:key,reward:{accountReward:{key,title:n.title,softCurrency:n.reward.softCurrency,packTickets:n.reward.packTickets,styleShards:n.reward.styleShards+duplicateShards},duplicateShards}});
 if(final)await tx.insert(playerCollectionClaimsTable).values({clerkUserId:userId,milestoneKey:legendBountyKey(id),reward:{cardId:id,duplicateShards}});
 await tx.update(playerProfilesTable).set({ownedCardIds,discoveredCardIds:final?[...new Set([...profile.discoveredCardIds,id])]:profile.discoveredCardIds,collectionProgress:ownedCardIds.length,
 softCurrency:profile.softCurrency+n.reward.softCurrency,packTickets:profile.packTickets+n.reward.packTickets,styleShards:profile.styleShards+n.reward.styleShards+duplicateShards,updatedAt:new Date()}).where(eq(playerProfilesTable.clerkUserId,userId));
 return {claimed:true,duplicateShards,unlocked:final,nodeId:n.id,reward:n.reward};
 });
}
