import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { getMail, updateMail } from '../lib/mail';
const router = Router();
router.get('/player/mail', async (req, res) => {
  const id = getAuth(req).userId;
  if (!id) { res.status(401).json({ error: 'Authentication required' }); return; }
  try { res.json({ messages: await getMail(id) }); }
  catch { res.status(503).json({ error: 'Mail is unavailable. Please retry.' }); }
});
router.post('/player/mail/:id/:action', async (req, res) => {
  const id = getAuth(req).userId;
  if (!id) { res.status(401).json({ error: 'Authentication required' }); return; }
  if (!['read', 'claim'].includes(String(req.params.action))) { res.status(400).json({ error: 'Invalid action' }); return; }
  try { res.json(await updateMail(id, String(req.params.id), req.params.action === 'claim')); }
  catch { res.status(409).json({ error: 'Mail could not be updated. Retry to confirm your saved delivery.' }); }
});
export default router;
