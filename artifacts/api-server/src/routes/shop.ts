import { getAuth } from '@clerk/express';
import { Router } from 'express';
import { EquipPlayerCosmeticsBody, GetPlayerBootstrapResponse, PurchasePlayerShopItemBody } from '@workspace/api-zod';
import { SHOP_OFFERS, ShopRuleError, ECONOMY_VERSION } from '@workspace/squabblemon-engine/economy';
import { purchaseShopItem } from '../lib/shopTransactions';
import { getPlayerBootstrap } from '../lib/playerState';
import { EconomyTransactionError } from '../lib/collectionTransactions';

import { equipCosmetics } from '../lib/cosmeticTransactions';

export const ShopPurchaseBody = PurchasePlayerShopItemBody.strict();
const router = Router();
router.get('/player/shop', (req, res) => {
  if (!getAuth(req).userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  res.json({ version: ECONOMY_VERSION, offers: SHOP_OFFERS });
});
router.post('/player/shop/purchases', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  const parsed = ShopPurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Choose a valid shop item and purchase request.' }); return; }
  try {
    await getPlayerBootstrap(userId);
    const result = await purchaseShopItem(userId, parsed.data);
    res.json({ ...result, bootstrap: await getPlayerBootstrap(userId) });
  } catch (error) {
    if (error instanceof ShopRuleError) { res.status(400).json({ error: error.message }); return; }
    if (error instanceof EconomyTransactionError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});
router.put('/player/cosmetics', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  const parsed = EquipPlayerCosmeticsBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Choose a valid banner, up to three stickers, and owned card scenes.' }); return; }
  try {
    await getPlayerBootstrap(userId);
    await equipCosmetics(userId, parsed.data);
    res.json(GetPlayerBootstrapResponse.parse(await getPlayerBootstrap(userId)));
  } catch (error) {
    if (error instanceof EconomyTransactionError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});
export default router;
