import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNewCheckoutGeography } from './geography';
import { currentDeploymentContext, runWithDeploymentContext } from '../runtimeDeploymentContext';

test('hosted new checkout fails closed; local test mode remains available', async () => {
  const keys = ['NETLIFY', 'APP_ENV', 'PAYMENTS_MODE'];
  const before = keys.map(key => process.env[key]);
  try {
    process.env.NETLIFY = 'true';
    process.env.APP_ENV = 'production';
    process.env.PAYMENTS_MODE = 'test';
    assert.throws(() => assertNewCheckoutGeography(), /United States/);
    const runtime = { deployId: 'test-deploy', context: 'production', origin: 'https://example.test' };
    for (const countryCode of [undefined, '', 'CA', 'us']) {
      assert.throws(() => assertNewCheckoutGeography({ ...runtime, countryCode }), /United States/);
    }
    assert.doesNotThrow(() => assertNewCheckoutGeography({ ...runtime, countryCode: 'US' }));
    assert.throws(() => assertNewCheckoutGeography({ ...runtime, context: 'unknown', countryCode: 'US' }));
    assert.doesNotThrow(() => assertNewCheckoutGeography({ ...runtime, context: 'deploy-preview', countryCode: 'US' }));
    assert.throws(() => assertNewCheckoutGeography({ ...runtime, context: 'deploy-preview' }));
    await Promise.all(['US', 'CA'].map(countryCode =>
      runWithDeploymentContext({ ...runtime, countryCode }, async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(currentDeploymentContext()?.countryCode, countryCode);
      })));
    assert.equal(currentDeploymentContext(), undefined);
    delete process.env.NETLIFY;
    process.env.APP_ENV = 'development';
    assert.doesNotThrow(() => assertNewCheckoutGeography());
    process.env.APP_ENV = 'production';
    assert.throws(() => assertNewCheckoutGeography());
  } finally {
    keys.forEach((key, index) => {
      if (before[index] === undefined) delete process.env[key];
      else process.env[key] = before[index];
    });
  }
});