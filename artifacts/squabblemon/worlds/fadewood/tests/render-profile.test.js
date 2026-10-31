import test from 'node:test';
import assert from 'node:assert/strict';
import { getRenderProfile } from '../src/render-profile.js';
import { verifyMobileCharacters } from '../scripts/verify-mobile-characters.mjs';

test('phones and narrow windows use lossless compact assets and a bounded pixel budget', () => {
  for (const width of [320, 390, 430, 768, 900]) {
    const profile = getRenderProfile({ width, devicePixelRatio: 3 });
    assert.equal(profile.name, 'mobile');
    assert.equal(profile.characterAssetDirectory, 'characters-mobile');
    assert.equal(profile.pixelRatio, 1.25);
    assert.equal(profile.antialias, false);
  }
});

test('wide touch screens and low-memory devices use compact assets with their existing render settings', () => {
  const tablet = getRenderProfile({ width: 1366, coarsePointer: true, devicePixelRatio: 2 });
  assert.equal(tablet.name, 'mobile'); assert.equal(tablet.mobile, true); assert.equal(tablet.pixelRatio, 1.25);
  assert.equal(tablet.characterAssetDirectory, 'characters-mobile');
  const low = getRenderProfile({ width: 1440, deviceMemory: 4, devicePixelRatio: 2 });
  assert.equal(low.name, 'desktop-low'); assert.equal(low.pixelRatio, 1);
  assert.equal(low.characterAssetDirectory, 'characters-mobile');
  assert.equal(low.antialias, false);
  assert.equal(getRenderProfile({ width: 430, deviceMemory: 2 }).name, 'mobile-low');
});

test('desktop uses compact assets while retaining antialiasing and the desktop pixel budget', () => {
  const desktop = getRenderProfile({ width: 901, devicePixelRatio: 2 });
  assert.equal(desktop.name, 'desktop'); assert.equal(desktop.mobile, false); assert.equal(desktop.antialias, true);
  assert.equal(desktop.pixelRatio, 1.5); assert.equal(desktop.characterAssetDirectory, 'characters-mobile');
  assert.equal(getRenderProfile({ devicePixelRatio: .8 }).pixelRatio, .8);
  assert.equal(getRenderProfile({ deviceMemory: null }).lowMemory, false);
  assert.equal(getRenderProfile({ deviceMemory: 0 }).lowMemory, false);
});

test('invalid and missing browser hints produce finite immutable render settings', () => {
  const profile = getRenderProfile({ width: NaN, height: 0, devicePixelRatio: Infinity, deviceMemory: NaN });
  assert.equal(profile.viewportWidth, 1280); assert.equal(profile.viewportHeight, 720);
  assert.equal(profile.pixelRatio, 1); assert.equal(profile.lowMemory, false);
  assert.equal(profile.characterAssetDirectory, 'characters-mobile');
  assert.ok(Object.isFrozen(profile));
});

test('all eleven compact GLBs preserve original art, binary geometry, rigs and actual animated poses', { skip: !process.env.FADEWOOD_SOURCE_ASSETS ? 'Optional authoring audit requires external character masters; runtime delivery intentionally excludes them.' : false }, async () => {
  const report = await verifyMobileCharacters();
  assert.equal(report.passed, true);
  assert.equal(report.characters, 11);
  assert.equal(report.sourceClips, 107);
  assert.equal(report.mobileClips, 11);
  assert.equal(report.comparedPoses, 33);
});
