import { getAuth } from '@clerk/express';
import { Router } from 'express';
import { RedeemPlayerPromoCodeBody } from '@workspace/api-zod';
import { EconomyTransactionError } from '../lib/collectionTransactions';
import { redeemPromoCode } from '../lib/promoCodeTransactions';
import { getPlayerBootstrap } from '../lib/playerState';

export const PromoCodeBody = RedeemPlayerPromoCodeBody.strict();
const router = Router();

router.post('/player/promo-codes/redeem', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  const parsed = PromoCodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Enter a valid promo code.' }); return; }
  try {
    await getPlayerBootstrap(userId);
    const result = await redeemPromoCode(userId, parsed.data.code);
    res.json({ ...result, bootstrap: await getPlayerBootstrap(userId) });
  } catch (error) {
    if (error instanceof EconomyTransactionError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

export default router;
