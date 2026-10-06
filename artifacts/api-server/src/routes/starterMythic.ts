import { getJohnHenryMythic, claimJohnHenryMythic } from '../lib/johnHenryMythic';
import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { claimStarterMythic, getStarterMythic } from '../lib/starterMythic';
import { getPlayerBootstrap } from '../lib/playerState';
import { PlayerRewardError } from '../lib/playerRewardTransactions';

const router = Router();
router.get('/player/rewards/starter-mythic', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  try { res.json(await getStarterMythic(userId)); }
  catch (error) { res.status(error instanceof PlayerRewardError ? error.status : 503).json({ error: 'Could not load Nothing to Lose. Try again.' }); }
});
router.post('/player/rewards/starter-mythic/claim', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const reward = await claimStarterMythic(userId);
    res.json({ ...reward, status: await getStarterMythic(userId), bootstrap: await getPlayerBootstrap(userId) });
  } catch (error) {
    res.status(error instanceof PlayerRewardError ? error.status : 503).json({ error: error instanceof PlayerRewardError ? error.message : 'Your reward could not be confirmed. Retry to check your saved claim.' });
  }
});
router.get('/player/rewards/john-henry', async (req,res)=>{
  const userId=getAuth(req).userId;
  if(!userId){res.status(401).json({error:'Authentication required'});return;}
  try{res.json(await getJohnHenryMythic(userId));}catch(error){res.status(error instanceof PlayerRewardError?error.status:503).json({error:'Could not load Steel Driver. Try again.'});}
});
router.post('/player/rewards/john-henry/claim',async(req,res)=>{
  const userId=getAuth(req).userId;
  if(!userId){res.status(401).json({error:'Authentication required'});return;}
  try{const reward=await claimJohnHenryMythic(userId);res.json({...reward,status:await getJohnHenryMythic(userId),bootstrap:await getPlayerBootstrap(userId)});}
  catch(error){res.status(error instanceof PlayerRewardError?error.status:503).json({error:error instanceof PlayerRewardError?error.message:'Could not confirm your Mythical. Retry to check the saved claim.'});}
});
export default router;
