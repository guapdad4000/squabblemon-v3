import { getAuth } from '@clerk/express';
import { Router, type Request, type Response } from 'express';
import { OnlineError } from '@workspace/squabblemon-engine/multiplayer';
import { currentKumite, enterKumiteMatch, kumiteWinners, registerKumite, withdrawKumite } from '../lib/kumite';
import { claimKumiteFilm, pendingKumiteFilms } from '../lib/kumiteFilmReceipts';
import { hasAnunakiClient } from '../lib/onlineCompatibility';
import { CLIENT_CAPABILITIES_HEADER } from '@workspace/squabblemon-engine/multiplayer';

const router = Router();
const endpoint = (authenticated: boolean, action: (req: Request, userId: string | null) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const userId = getAuth(req).userId;
    if (authenticated && !userId) { res.status(401).json({ error: 'Sign in to enter Kumite.' }); return; }
    try { res.json(await action(req, userId)); }
    catch (error) {
      if (error instanceof OnlineError) { res.status(error.status).json({ error: error.message }); return; }
      req.log?.error({ err: error }, 'Kumite request failed');
      res.status(503).json({ error: 'Kumite is temporarily unavailable. Please retry.' });
    }
  };
function bodyOf(req: Request, keys: string[]) {
  const body: unknown = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key)))
    throw new OnlineError('Invalid Kumite request.', 400);
  return body as Record<string, unknown>;
}
router.get('/kumite/current', endpoint(false, (_req, userId) => currentKumite(userId)));
router.get('/kumite/winners', endpoint(false, () => kumiteWinners()));
router.get('/kumite/film-receipts', endpoint(true, (_req, userId) => pendingKumiteFilms(userId!)));
router.post('/kumite/film-receipts/claim', endpoint(true, (req, userId) => {
  const body = bodyOf(req, ['receiptId']);
  if (typeof body.receiptId !== 'string' || body.receiptId.length > 120) throw new OnlineError('Invalid fighter receipt.', 400);
  return claimKumiteFilm(userId!, body.receiptId);
}));
router.post('/kumite/register', endpoint(true, (req, userId) => {
  const body = bodyOf(req, ['deckId']);
  if (typeof body.deckId !== 'string' || body.deckId.length < 1 || body.deckId.length > 100)
    throw new OnlineError('Choose a saved gang.', 400);
  return registerKumite(userId!, body.deckId, hasAnunakiClient(req.get(CLIENT_CAPABILITIES_HEADER)));
}));
router.post('/kumite/withdraw', endpoint(true, (req, userId) => { bodyOf(req, []); return withdrawKumite(userId!); }));
router.post('/kumite/match', endpoint(true, (req, userId) => { bodyOf(req, []); return enterKumiteMatch(userId!, hasAnunakiClient(req.get(CLIENT_CAPABILITIES_HEADER))); }));
export default router;
