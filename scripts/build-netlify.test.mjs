import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentEnvironment, releaseEnvironment } from './build-netlify.mjs';

test('production releases require a live Clerk key and exact Netlify HTTPS origin',()=>{
  const base={CONTEXT:'production',URL:'https://game.example'};
  assert.throws(()=>releaseEnvironment(base),/pk_live_/);
  assert.throws(()=>releaseEnvironment({...base,VITE_CLERK_PUBLISHABLE_KEY:'pk_test_preview'}),/pk_live_/);
  assert.throws(()=>releaseEnvironment({...base,VITE_CLERK_PUBLISHABLE_KEY:'pk_live_prod',PUBLIC_ORIGIN:'https://other.example'}),/exactly match/);
  assert.throws(()=>releaseEnvironment({...base,VITE_CLERK_PUBLISHABLE_KEY:'pk_live_prod',PUBLIC_ORIGIN:'http://game.example'}),/HTTPS/);
  const env=releaseEnvironment({...base,VITE_CLERK_PUBLISHABLE_KEY:'pk_live_prod',PUBLIC_ORIGIN:'https://game.example/',VITE_E2E_AUTH:'true'});
  assert.equal(env.PUBLIC_ORIGIN,'https://game.example');
  assert.equal(env.VITE_E2E_AUTH,'false');
  assert.equal(env.BASE_PATH,'/');
  assert.equal(env.APP_ENV,'production');
});

test('preview and staging releases require test Clerk keys and their exact deploy origin',()=>{
  for (const context of ['deploy-preview','branch-deploy','staging']) {
    const source={CONTEXT:context,DEPLOY_PRIME_URL:'https://deploy-123.example.netlify.app',VITE_CLERK_PUBLISHABLE_KEY:'pk_test_stage'};
    const env=releaseEnvironment(source);
    assert.equal(env.APP_ENV,'staging');
    assert.equal(env.PUBLIC_ORIGIN,'https://deploy-123.example.netlify.app');
    assert.throws(()=>releaseEnvironment({...source,VITE_CLERK_PUBLISHABLE_KEY:'pk_live_prod'}),/pk_test_/);
  }
});

test('Netlify contexts are explicit and origins cannot include paths or queries',()=>{
  assert.throws(()=>deploymentEnvironment({NETLIFY:'true'}),/CONTEXT/);
  assert.throws(()=>deploymentEnvironment({CONTEXT:'unknown'}),/Unsupported/);
  assert.throws(()=>releaseEnvironment({CONTEXT:'deploy-preview',DEPLOY_PRIME_URL:'https://preview.example/path',VITE_CLERK_PUBLISHABLE_KEY:'pk_test_stage'}),/exact HTTPS origin/);
  assert.throws(()=>releaseEnvironment({APP_ENV:'staging',PUBLIC_ORIGIN:'https://preview.example?x=1',VITE_CLERK_PUBLISHABLE_KEY:'pk_test_stage'}),/exact HTTPS origin/);
});
