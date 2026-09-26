import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { runStoreSmokeCheck, storeCheckConfiguration } from './storeSmokeCheck';

const baseEnv = {
  STORE_CHECK_ORIGIN: 'https://squabble.today',
  CLERK_SECRET_KEY: 'sk_live_fixture',
  STORE_CHECK_USER_ID: 'user_smoke',
};

type FetchCall = { url: string; init: { headers?: Record<string, string> } };

function liveCatalog() {
  return {
    version: 'corner-clout-v2-tax',
    taxMode: 'automatic',
    mode: 'live',
    enabled: true,
    message: 'Secure checkout with Stripe.',
    supportUrl: 'https://squabble.today/support',
    refundPolicyUrl: 'https://squabble.today/refund-policy',
    offers: [
      { id: 'clout-pocket', enabled: true },
      { id: 'clout-stack', enabled: true },
      { id: 'clout-bag', enabled: true },
    ],
  };
}

function fakeFetch(catalog: unknown, catalogStatus = 200, overrides: { tokenFails?: boolean; revokeFails?: boolean } = {}) {
  const calls: FetchCall[] = [];
  const impl = async (url: string | URL | Request, init: { headers?: Record<string, string> } = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    if (target.endsWith('/v1/sessions')) return json({ id: 'sess_smoke' });
    if (target.includes('/tokens')) {
      if (overrides.tokenFails) return { ok: false, status: 500, json: async () => ({}), text: async () => 'token failure' };
      return json({ jwt: 'jwt_fixture' });
    }
    if (target.includes('/revoke')) {
      if (overrides.revokeFails) return { ok: false, status: 500, json: async () => ({}), text: async () => 'revoke failure' };
      return json({ id: 'sess_smoke', status: 'revoked' });
    }
    if (target.endsWith('/api/player/payments/catalog')) {
      if (!init.headers?.authorization) return { ok: false, status: 401, json: async () => ({}), text: async () => 'Authentication required' };
      if (catalogStatus !== 200) return { ok: false, status: catalogStatus, json: async () => ({}), text: async () => 'unavailable' };
      return json(typeof catalog === 'function' ? catalog() : catalog);
    }
    throw new Error(`Unexpected request: ${target}`);
  };
  return { calls, fetch: impl as unknown as typeof fetch };
}

test('configuration requires an exact HTTPS origin, matching Clerk key, and smoke user', () => {
  assert.throws(() => storeCheckConfiguration({}), /STORE_CHECK_ORIGIN/);
  assert.throws(() => storeCheckConfiguration({ ...baseEnv, STORE_CHECK_ORIGIN: 'http://squabble.today' }), /HTTPS/);
  assert.throws(() => storeCheckConfiguration({ ...baseEnv, STORE_CHECK_ORIGIN: 'https://squabble.today/path' }), /exact HTTPS origin/);
  assert.throws(() => storeCheckConfiguration({ ...baseEnv, CLERK_SECRET_KEY: 'sk_test_fixture' }), /matching live/);
  assert.throws(() => storeCheckConfiguration({ ...baseEnv, STORE_CHECK_USER_ID: '' }), /STORE_CHECK_USER_ID/);
  assert.throws(() => storeCheckConfiguration({ ...baseEnv, STORE_CHECK_EXPECT_MODE: 'staging' }), /live or test/);
  assert.throws(() => storeCheckConfiguration({ ...baseEnv, STORE_CHECK_ALERT_WEBHOOK: 'http://alerts.example' }), /HTTPS/);
  const config = storeCheckConfiguration({ ...baseEnv, STORE_CHECK_ORIGIN: 'https://squabble.today/' });
  assert.equal(config.origin, 'https://squabble.today');
  assert.equal(config.mode, 'live');
  const testConfig = storeCheckConfiguration({ ...baseEnv, CLERK_SECRET_KEY: 'sk_test_fixture', STORE_CHECK_EXPECT_MODE: 'test' });
  assert.equal(testConfig.mode, 'test');
});

test('passes when the deployed catalog reports checkout enabled in live mode', async () => {
  const { calls, fetch } = fakeFetch(liveCatalog());
  const catalog = await runStoreSmokeCheck(baseEnv, fetch);
  assert.equal(catalog.enabled, true);
  assert.equal(catalog.mode, 'live');
  const catalogCalls = calls.filter(call => call.url.endsWith('/api/player/payments/catalog'));
  assert.equal(catalogCalls.length, 2);
  assert.equal(catalogCalls[0].init.headers?.authorization, undefined);
  assert.equal(catalogCalls[1].init.headers?.authorization, 'Bearer jwt_fixture');
  assert.ok(calls.some(call => call.url.includes('/revoke')), 'smoke session must be revoked');
});

test('fails the release when the store quietly disables checkout', async () => {
  const { fetch } = fakeFetch({ ...liveCatalog(), enabled: false, mode: 'disabled', message: 'Live payments await merchant and policy approval.' });
  await assert.rejects(
    runStoreSmokeCheck(baseEnv, fetch),
    error => error instanceof Error && /turned checkout off/.test(error.message) && /Live payments await merchant and policy approval/.test(error.message),
  );
});

test('fails when the mode is not live or individual offers are unavailable', async () => {
  const wrongMode = fakeFetch({ ...liveCatalog(), mode: 'test' });
  await assert.rejects(runStoreSmokeCheck(baseEnv, wrongMode.fetch), /mode=test/);
  const missingOffer = fakeFetch({ ...liveCatalog(), offers: [{ id: 'clout-pocket', enabled: true }, { id: 'clout-stack', enabled: false }] });
  await assert.rejects(runStoreSmokeCheck(baseEnv, missingOffer.fetch), /clout-stack/);
});

test('fails when the payment boundary stops requiring sign-in or errors', async () => {
  const open = fakeFetch(liveCatalog());
  const openFetch = (async (url: string | URL | Request, init: { headers?: Record<string, string> } = {}) => {
    if (String(url).endsWith('/api/player/payments/catalog') && !init.headers?.authorization) {
      return { ok: true, status: 200, json: async () => liveCatalog(), text: async () => '' };
    }
    return open.fetch(url, init);
  }) as unknown as typeof fetch;
  await assert.rejects(runStoreSmokeCheck(baseEnv, openFetch), /must require sign-in/);
  const { fetch } = fakeFetch(liveCatalog(), 503);
  await assert.rejects(runStoreSmokeCheck(baseEnv, fetch), /503/);
});

test('revokes the smoke session even when token minting fails after session creation', async () => {
  const { calls, fetch } = fakeFetch(liveCatalog(), 200, { tokenFails: true });
  await assert.rejects(runStoreSmokeCheck(baseEnv, fetch), /tokens/);
  assert.ok(calls.some(call => call.url.includes('/revoke')), 'session must be revoked after token minting failure');
});

test('still revokes the smoke session when the catalog assertion fails', async () => {
  const { calls, fetch } = fakeFetch({ ...liveCatalog(), enabled: false, mode: 'disabled' });
  await assert.rejects(runStoreSmokeCheck(baseEnv, fetch));
  assert.ok(calls.some(call => call.url.includes('/revoke')), 'session revoked even on failure');
});

test('surfaces revocation failures in logs without masking a passing check', async t => {
  const errorSpy = mock.method(console, 'error', () => {});
  t.after(() => errorSpy.mock.restore());
  const { fetch } = fakeFetch(liveCatalog(), 200, { revokeFails: true });
  const catalog = await runStoreSmokeCheck(baseEnv, fetch);
  assert.equal(catalog.enabled, true);
  assert.ok(errorSpy.mock.calls.some(call => /was not revoked/.test(String(call.arguments[0]))), 'revocation failure must be logged');
});

test('posts to the alert webhook on failure without masking the original error', async t => {
  const errorSpy = mock.method(console, 'error', () => {});
  t.after(() => errorSpy.mock.restore());
  const disabled = { ...liveCatalog(), enabled: false, mode: 'disabled', message: 'Live payments await merchant and policy approval.' };
  const alerting = fakeFetch(disabled);
  const alertFetch = (async (url: string | URL | Request, init: { headers?: Record<string, string> } = {}) => {
    if (String(url) === 'https://alerts.example/hook') return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    return alerting.fetch(url, init);
  }) as unknown as typeof fetch;
  await assert.rejects(
    runStoreSmokeCheck({ ...baseEnv, STORE_CHECK_ALERT_WEBHOOK: 'https://alerts.example/hook' }, alertFetch),
    /turned checkout off/,
  );
  assert.ok(alerting.calls.every(call => call.url !== 'https://alerts.example/hook'));
  const failingAlert = fakeFetch(disabled);
  const badAlertFetch = (async (url: string | URL | Request, init: { headers?: Record<string, string> } = {}) => {
    if (String(url) === 'https://alerts.example/hook') return { ok: false, status: 500, json: async () => ({}), text: async () => 'down' };
    return failingAlert.fetch(url, init);
  }) as unknown as typeof fetch;
  await assert.rejects(
    runStoreSmokeCheck({ ...baseEnv, STORE_CHECK_ALERT_WEBHOOK: 'https://alerts.example/hook' }, badAlertFetch),
    error => error instanceof Error && /turned checkout off/.test(error.message) && !/webhook/.test(error.message),
  );
  assert.ok(errorSpy.mock.calls.some(call => /alert could not be delivered/.test(String(call.arguments[0]))), 'alert delivery failure must be logged');
});
