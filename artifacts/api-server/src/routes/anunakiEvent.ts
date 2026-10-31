import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { claimAnunakiEvent, getAnunakiEvent } from '../lib/anunakiEvent';
import { getPlayerBootstrap } from '../lib/playerState';
import { PlayerRewardError } from '../lib/playerRewardTransactions';

const router = Router();
router.get('/player/rewards/anunaki-event', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  try { res.json(await getAnunakiEvent(userId)); }
  catch (error) { res.status(error instanceof PlayerRewardError ? error.status : 503).json({ error: 'Could not load the Anunaki event.' }); }
});
router.post('/player/rewards/anunaki-event/claim', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const reward = await claimAnunakiEvent(userId, typeof req.body?.milestoneId === 'string' ? req.body.milestoneId : '');
    res.json({ ...reward, status: await getAnunakiEvent(userId), bootstrap: await getPlayerBootstrap(userId) });
  } catch (error) {
    res.status(error instanceof PlayerRewardError ? error.status : 503).json({ error: error instanceof PlayerRewardError ? error.message : 'Your reward could not be confirmed. Retry to check your saved claim.' });
  }
});
export default router;
