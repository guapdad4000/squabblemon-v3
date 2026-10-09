import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { getLegendBounties,claimLegendBounty } from '../lib/legendBounties';
import { getPlayerBootstrap } from '../lib/playerState';
import { PlayerRewardError } from '../lib/playerRewardTransactions';
const router=Router();
router.get('/player/rewards/legend-bounties',async(req,res)=>{
 const user=getAuth(req).userId;if(!user){res.status(401).json({error:'Authentication required'});return;}
 try{await getPlayerBootstrap(user);res.json(await getLegendBounties(user));}catch(e){res.status(e instanceof PlayerRewardError?e.status:503).json({error:'Could not load legend bounties'});}
});
router.post(['/player/rewards/legend-bounties/:id/claim','/player/rewards/legend-bounties/:id/nodes/:nodeId/claim'],async(req,res)=>{
 const user=getAuth(req).userId;if(!user){res.status(401).json({error:'Authentication required'});return;}
 try{await getPlayerBootstrap(user);const reward=await claimLegendBounty(user,String(req.params.id),req.params.nodeId?String(req.params.nodeId):undefined);res.json({...reward,statuses:await getLegendBounties(user),bootstrap:await getPlayerBootstrap(user)});}
 catch(e){res.status(e instanceof PlayerRewardError?e.status:503).json({error:e instanceof PlayerRewardError?e.message:'Could not confirm reward. Retry to check your saved claim.'});}
});
export default router;
