// Post-deploy store smoke check. Live checkout once disabled itself silently
// because the payment gate read build-only env vars that Netlify functions
// never receive — every flag looked correct while the catalog reported
// "Live payments await merchant and policy approval." This check authenticates
// as a dedicated smoke-check Clerk user against the deployed origin and fails
// (alerting the operator) unless the store reports checkout enabled in the
// expected mode. Shared by the deploy-succeeded Netlify event function and the
// operator CLI (src/tools/store-smoke-check.ts).
const CLERK_API = 'https://api.clerk.com/v1';
const TIMEOUT_MS = 15_000;

export type StoreSmokeConfig = {
  origin: string;
  mode: 'live' | 'test';
  secretKey: string;
  userId: string;
  alertWebhook?: string;
};

type EnvSource = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export function storeCheckConfiguration(source: EnvSource): StoreSmokeConfig {
  const raw = source.STORE_CHECK_ORIGIN;
  if (!raw) throw new Error('Configure STORE_CHECK_ORIGIN before running the store smoke check.');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.origin !== raw.replace(/\/$/, '')) {
    throw new Error('STORE_CHECK_ORIGIN must be an exact HTTPS origin with no path, query, or fragment.');
  }
  const mode = source.STORE_CHECK_EXPECT_MODE ?? 'live';
  if (mode !== 'live' && mode !== 'test') throw new Error('STORE_CHECK_EXPECT_MODE must be live or test.');
  const secretKey = source.CLERK_SECRET_KEY?.trim();
  if (!secretKey || !secretKey.startsWith(mode === 'live' ? 'sk_live_' : 'sk_test_')) {
    throw new Error(`The store smoke check requires a CLERK_SECRET_KEY matching ${mode} mode.`);
  }
  const userId = source.STORE_CHECK_USER_ID?.trim();
  if (!userId) throw new Error('STORE_CHECK_USER_ID must name the dedicated smoke-check Clerk user.');
  const alertWebhook = source.STORE_CHECK_ALERT_WEBHOOK?.trim() || undefined;
  if (alertWebhook && !alertWebhook.startsWith('https://')) {
    throw new Error('STORE_CHECK_ALERT_WEBHOOK must be an HTTPS URL.');
  }
  return { origin: url.origin, mode, secretKey, userId, alertWebhook };
}

async function clerkRequest(config: StoreSmokeConfig, fetchImpl: FetchLike, path: string, body?: unknown) {
  const response = await fetchImpl(`${CLERK_API}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { authorization: `Bearer ${config.secretKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw new Error(`Clerk ${path} returned ${response.status}; smoke-check authentication failed.`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function revokeSession(config: StoreSmokeConfig, fetchImpl: FetchLike, sessionId: string): Promise<void> {
  await clerkRequest(config, fetchImpl, `/sessions/${sessionId}/revoke`, {});
}

function describeCleanup(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function mintSessionToken(config: StoreSmokeConfig, fetchImpl: FetchLike) {
  // A short-lived session minted through the Clerk Backend API stands in for a
  // real player sign-in; it is revoked on every exit path, including a token
  // minting failure after the session was created.
  const session = await clerkRequest(config, fetchImpl, '/sessions', { user_id: config.userId });
  if (!session?.id || typeof session.id !== 'string') throw new Error('Clerk did not return a smoke-check session.');
  try {
    const token = await clerkRequest(config, fetchImpl, `/sessions/${session.id}/tokens`, { expires_in_seconds: 60 });
    if (!token?.jwt || typeof token.jwt !== 'string') throw new Error('Clerk did not return a smoke-check session token.');
    return { sessionId: session.id, jwt: token.jwt };
  } catch (error) {
    await revokeSession(config, fetchImpl, session.id).catch(cleanup =>
      console.error(`Store smoke check cleanup: smoke session ${session.id} was not revoked after token minting failed: ${describeCleanup(cleanup)}`));
    throw error;
  }
}

async function alertStoreCheckFailure(config: StoreSmokeConfig, error: unknown, fetchImpl: FetchLike): Promise<void> {
  if (!config.alertWebhook) return;
  const text = `STORE SMOKE CHECK FAILED — the deployed store may have disabled checkout. ${error instanceof Error ? error.message : String(error)}`;
  const response = await fetchImpl(config.alertWebhook, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Alert webhook returned ${response.status}.`);
}

export async function runStoreSmokeCheck(source: EnvSource, fetchImpl: FetchLike = fetch) {
  const config = storeCheckConfiguration(source);
  const catalogUrl = `${config.origin}/api/player/payments/catalog`;
  try {
    const anonymous = await fetchImpl(catalogUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (anonymous.status !== 401) {
      throw new Error(`Unauthenticated catalog request returned ${anonymous.status}; the player payment boundary must require sign-in.`);
    }

    const session = await mintSessionToken(config, fetchImpl);
    let catalog: { enabled?: boolean; mode?: string; message?: string; offers?: Array<{ id?: string; enabled?: boolean }> };
    try {
      const response = await fetchImpl(catalogUrl, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { authorization: `Bearer ${session.jwt}` },
      });
      if (response.status !== 200) {
        throw new Error(`Authenticated catalog request returned ${response.status}: ${await response.text()}`);
      }
      catalog = await response.json() as typeof catalog;
      const problems: string[] = [];
      if (catalog?.enabled !== true) problems.push(`enabled=${catalog?.enabled}`);
      if (catalog?.mode !== config.mode) problems.push(`mode=${catalog?.mode}`);
      const unavailable = (catalog?.offers ?? []).filter(offer => offer?.enabled !== true).map(offer => offer?.id ?? 'unknown');
      if (unavailable.length) problems.push(`offers disabled: ${unavailable.join(', ')}`);
      if (problems.length) {
        throw new Error(`The deployed store turned checkout off (${problems.join('; ')}). Catalog message: ${catalog?.message ?? 'none'}`);
      }
    } finally {
      // Cleanup failures must not mask the check result but must be visible in
      // function/operator logs so leaked smoke sessions are investigated.
      await revokeSession(config, fetchImpl, session.sessionId).catch(cleanup =>
        console.error(`Store smoke check cleanup: smoke session ${session.sessionId} was not revoked: ${describeCleanup(cleanup)}`));
    }
    return catalog;
  } catch (error) {
    await alertStoreCheckFailure(config, error, fetchImpl).catch(alertError =>
      console.error(`Store smoke check alert could not be delivered: ${describeCleanup(alertError)}`));
    throw error;
  }
}
