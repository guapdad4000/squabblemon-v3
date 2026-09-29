// Isolated, loopback-only real API + nested Vite game-shell browser host.
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { createApp } from '../../api-server/src/app';
import { db, pool, playerProfilesTable } from '../../../lib/db/src/index';
import { cardCatalog, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import type { Request } from 'express';

const database = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL);
if (process.env.EVENTS_FEEDBACK_TEST_OWNED !== '1' || !database ||
    !['localhost', '127.0.0.1', '::1'].includes(database.hostname) ||
    !Number.isInteger(Number(process.env.EVENTS_E2E_PORT)) ||
    Number(process.env.EVENTS_E2E_PORT) < 1024) {
  throw new Error('Events browser host requires EVENTS_FEEDBACK_TEST_OWNED=1, loopback DATABASE_URL and EVENTS_E2E_PORT.');
}
pool.options.max = 1;
const ids = { a: `events-browser-${randomUUID()}`, b: `events-browser-${randomUUID()}` };
await db.insert(playerProfilesTable).values(Object.entries(ids).map(([seat, id]) => ({
  clerkUserId: id,
  displayName: seat === 'a' ? 'Events Writer' : 'Events Reader',
  onboardingStep: 'complete',
  starterRewardClaimed: true,
  tutorialCompleted: true,
  ownedCardIds: cardCatalog.map(card => card.catalogId),
  savedDecks: [{
    id: `events-crew-${seat}`, name: 'THE REGULARS', heroCardId: 'kyle',
    cardIds: [...ROOKIE_CORE_IDS],
  }],
  settings: { reducedMotion: true, turnTimerEnabled: true },
})));
const identify = (req: Request) =>
  req.headers.cookie?.includes('events_test_seat=a') ? ids.a :
  req.headers.cookie?.includes('events_test_seat=b') ? ids.b : null;
const app = createApp((req, _res, next) => {
  const userId = identify(req);
  (req as unknown as { auth: unknown }).auth = Object.assign(
    () => ({
      userId, sessionId: userId ? 'events-test-session' : null,
      tokenType: 'session_token', isAuthenticated: !!userId,
    }),
    { [Symbol.for('@clerk/express.auth')]: true },
  );
  next();
});
const vite = await createServer({
  configFile: 'artifacts/squabblemon/vite.config.ts',
  cacheDir: resolve(import.meta.dirname, '../node_modules/.vite-events-browser-e2e'),
  server: { middlewareMode: true, hmr: false },
  appType: 'spa',
});
app.use(vite.middlewares);
const server = app.listen(Number(process.env.EVENTS_E2E_PORT), '127.0.0.1', () =>
  console.log(`Events browser test host ready at http://127.0.0.1:${process.env.EVENTS_E2E_PORT}/squabblemon/game/events`),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise<void>(done => server.close(() => done()));
  await vite.close();
  // The owned database is discarded by the parent DB runner.
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });