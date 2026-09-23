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
