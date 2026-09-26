import assert from 'node:assert/strict';

// Exercise the shipped bundle in a fresh Node process. No account service or
// database connection is needed for health and anonymous-access checks.
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k';
process.env.CLERK_SECRET_KEY = 'sk_test_build_validation_only';
process.env.LOG_LEVEL = 'silent';
process.env.CLERK_TELEMETRY_DISABLED = '1';
globalThis.Netlify = { env: { get: key => process.env[key] } };
const { default: handler, config } = await import('../artifacts/api-server/dist/netlify-functions/api.mjs');
assert.equal(typeof handler, 'function');
assert.deepEqual(config.path, ['/api', '/api/*']);
for (const [path, status] of [
  ['/api/healthz', 200],
  ['/api/player/bootstrap', 401],
  ['/api/multiplayer', 401],
]) {
  const response = await handler(new Request(`https://squabble.today${path}`), {
    ip: '127.0.0.1',
    deploy: {
      context: 'staging',
      id: 'release-build-smoke',
    },
  });
  assert.equal(response.status, status, `${path}: ${await response.text()}`);
}
console.log('Release API bundle: health and anonymous-access checks passed.');

// The deploy-succeeded event function is the post-deploy store smoke check:
// Netlify invokes it after every successful deploy, and it must authenticate
// against the just-deployed origin and fail loudly unless the payment catalog
// reports checkout enabled in live mode. Exercise the shipped bundle with a
// mocked Clerk Backend API and catalog so this release gate proves the real
// post-deploy command — not just its unit suite — is part of the release path.
const { default: deploySucceeded } = await import('../artifacts/api-server/dist/netlify-functions/deploy-succeeded.mjs');
assert.equal(typeof deploySucceeded, 'function');
process.env.STORE_CHECK_USER_ID = 'user_smoke_build_validation';
process.env.STORE_CHECK_ORIGIN = 'https://squabble.today';
process.env.STORE_CHECK_ALERT_WEBHOOK = 'https://alerts.example/hook';
process.env.CLERK_SECRET_KEY = 'sk_live_build_validation_only';
const liveCatalog = {
  version: 'corner-clout-v2-tax', taxMode: 'automatic', mode: 'live', enabled: true,
  message: 'Secure checkout with Stripe.',
  offers: [{ id: 'clout-pocket', enabled: true }, { id: 'clout-stack', enabled: true }, { id: 'clout-bag', enabled: true }],
};
function stubFetch(catalog) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    const json = body => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    if (target.endsWith('/v1/sessions')) return json({ id: 'sess_smoke' });
    if (target.includes('/tokens')) return json({ jwt: 'jwt_fixture' });
    if (target.includes('/revoke')) return json({ id: 'sess_smoke', status: 'revoked' });
    if (target === 'https://alerts.example/hook') return json({ ok: true });
    if (target === 'https://squabble.today/api/player/payments/catalog') {
      if (!init.headers?.authorization) return { ok: false, status: 401, json: async () => ({}), text: async () => 'Authentication required' };
      return json(catalog);
    }
    throw new Error(`Unexpected request: ${target}`);
  };
  return { calls, fetch: impl };
}
const deployEvent = context => new Request('https://events.netlify/deploy-succeeded', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ payload: { context, ssl_url: 'https://squabble.today' } }),
});
const originalFetch = globalThis.fetch;
try {
  let stub = stubFetch(liveCatalog);
  globalThis.fetch = stub.fetch;
  await deploySucceeded(deployEvent('production'), { deploy: { context: 'production', id: 'release-build-smoke' } });
  const catalogCalls = stub.calls.filter(call => call.url.endsWith('/api/player/payments/catalog'));
  assert.equal(catalogCalls.length, 2, 'anonymous boundary check plus authenticated catalog check');
  assert.equal(catalogCalls[1].init.headers?.authorization, 'Bearer jwt_fixture');
  assert.ok(stub.calls.some(call => call.url.includes('/revoke')), 'smoke session revoked');
  assert.ok(!stub.calls.some(call => call.url === 'https://alerts.example/hook'), 'no alert on a healthy store');

  // A store that quietly disabled checkout fails the function invocation and alerts.
  stub = stubFetch({ ...liveCatalog, enabled: false, mode: 'disabled', message: 'Live payments await merchant and policy approval.' });
  globalThis.fetch = stub.fetch;
  await assert.rejects(
    deploySucceeded(deployEvent('production'), { deploy: { context: 'production', id: 'release-build-smoke' } }),
    /turned checkout off/,
  );
  assert.ok(stub.calls.some(call => call.url === 'https://alerts.example/hook'), 'alert webhook notified');

  // Non-production deploys skip the live-mode assertion entirely.
  stub = stubFetch(liveCatalog);
  globalThis.fetch = stub.fetch;
  await deploySucceeded(deployEvent('deploy-preview'), { deploy: { context: 'deploy-preview', id: 'release-build-smoke' } });
  assert.ok(!stub.calls.some(call => call.url.endsWith('/api/player/payments/catalog')), 'preview deploys skip the live store check');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Release API bundle: deploy-succeeded store smoke check passed, alerts on disabled checkout, and skips previews.');

// Account configuration must not prevent Stripe from settling previously paid
// orders. Only the exact signed-webhook endpoint bypasses this preflight.
delete process.env.CLERK_SECRET_KEY;
delete process.env.CLERK_PUBLISHABLE_KEY;
for (const [path, method, status] of [
  ['/api/payments/webhook', 'POST', 400],
  ['/api/payments/webhook', 'GET', 503],
  ['/api/player/payments/checkout', 'POST', 503],
  ['/api/payments/webhook/other', 'POST', 503],
]) {
  const response = await handler(new Request(`https://squabble.today${path}`, {
    method, ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}),
  }), { ip: '127.0.0.1', deploy: { context: 'staging', id: 'release-build-smoke' } });
  assert.equal(response.status, status, `Auth configuration boundary: ${path}: ${await response.text()}`);
}
console.log('Release API bundle: only the exact raw payment webhook bypasses Clerk configuration.');
