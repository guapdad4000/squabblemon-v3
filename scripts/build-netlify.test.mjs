import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseEnvironment } from './build-netlify.mjs';
test('release refuses missing sign-in configuration and never ships test auth',()=>{
  assert.throws(()=>releaseEnvironment({PUBLIC_ORIGIN:'https://game.example'}),/VITE_CLERK/);
  assert.throws(()=>releaseEnvironment({VITE_CLERK_PUBLISHABLE_KEY:'pk_live_test',PUBLIC_ORIGIN:'http://game.example'}),/HTTPS/);
  const env=releaseEnvironment({VITE_CLERK_PUBLISHABLE_KEY:'pk_live_test',PUBLIC_ORIGIN:'https://game.example/',VITE_E2E_AUTH:'true'});
  assert.equal(env.PUBLIC_ORIGIN,'https://game.example'); assert.equal(env.VITE_E2E_AUTH,'false'); assert.equal(env.BASE_PATH,'/');
});
