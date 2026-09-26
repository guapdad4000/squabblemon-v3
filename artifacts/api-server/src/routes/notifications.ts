import { getAuth } from '@clerk/express';
import { Router } from 'express';
import { cleanNotificationReceiptIds, getNotificationReceipts, saveNotificationReceipts } from '../lib/notificationReceipts';

const router = Router();

router.get('/player/notifications/receipts', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    res.json({ ids: await getNotificationReceipts(userId) });
  } catch {
    res.status(503).json({ error: 'Alerts could not be loaded. Try again.' });
  }
});

router.post('/player/notifications/receipts', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  const ids = cleanNotificationReceiptIds(req.body?.ids);
  if (!ids.length) { res.status(400).json({ error: 'At least one valid alert receipt is required' }); return; }
  try {
    res.json({ ids: await saveNotificationReceipts(userId, ids) });
  } catch {
    res.status(503).json({ error: 'Alerts could not be saved. Try again.' });
  }
});

export default router;
