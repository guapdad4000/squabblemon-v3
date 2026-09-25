import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { getDailyClout, claimDailyClout } from '../lib/dailyClout';
import { PlayerRewardError } from '../lib/playerRewardTransactions';
const router = Router();
router.get('/player/shop/daily-clout', async (req, res) => {
  const user = getAuth(req).userId;
  if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
  try { res.json(await getDailyClout(user)); } catch { res.status(503).json({ error: 'Daily rewards unavailable. Try again.' }); }
});
router.post('/player/shop/daily-clout/claim', async (req, res) => {
  const user = getAuth(req).userId;
  if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
  try { res.json({ ...await claimDailyClout(user), status: await getDailyClout(user) }); }
  catch (error) { res.status(error instanceof PlayerRewardError ? error.status : 503).json({ error: 'Could not confirm your claim. Retry safely.' }); }
});
export default router;
