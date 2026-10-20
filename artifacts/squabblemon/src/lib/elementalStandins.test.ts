import assert from 'node:assert/strict';
import test from 'node:test';
import { elementalStandin as referenceStandin } from './testFixtures/elementalStandins.reference';

const STANDIN_IDS = [
  'puddle-runner', 'rain-caller', 'hydrant-medic', 'floodgate-captain',
  'seed-vendor', 'sidewalk-vinekeeper', 'moss-keeper', 'canopy-auntie',
  'circuit-yn', 'switchboard-tech', 'flash-courier', 'power-station-operator',
  'gust-scout', 'rooftop-runner', 'block-messenger', 'skyline-captain',
] as const;

test('static elemental portraits preserve every byte and encode only once per requested portrait', async (t) => {
  const encode = globalThis.encodeURIComponent;
  let encodes = 0;
  t.mock.method(globalThis, 'encodeURIComponent', (value: string | number | boolean) => {
    encodes += 1;
    return encode(value);
  });

  const { elementalStandin } = await import('./elementalStandins');
  assert.equal(encodes, 0, 'module loading must not eagerly build unused portraits');
  const actual = STANDIN_IDS.map(id => elementalStandin(id));
  assert.equal(encodes, STANDIN_IDS.length, 'each first request encodes one portrait');

  encodes = 0;
  const expected = STANDIN_IDS.map(id => referenceStandin(id));
  assert.equal(encodes, STANDIN_IDS.length, 'the frozen implementation encodes every call');
  assert.deepEqual(actual, expected, 'the complete data URLs, including artwork and whitespace, are unchanged');
  assert.equal(new Set(actual).size, STANDIN_IDS.length, 'portraits remain distinct');

  // Repeated card renders formerly rebuilt and encoded each complete SVG.
  encodes = 0;
  const repeats = 250;
  for (let render = 0; render < repeats; render += 1) {
    assert.deepEqual(STANDIN_IDS.map(id => elementalStandin(id)), expected);
  }
  assert.equal(encodes, 0, '4,000 warm portrait requests perform no SVG encoding');

  for (let render = 0; render < repeats; render += 1) {
    assert.deepEqual(STANDIN_IDS.map(id => referenceStandin(id)), expected);
  }
  assert.equal(encodes, repeats * STANDIN_IDS.length, 'the same frozen workload performs 4,000 encodes');

  encodes = 0;
  for (const id of ['', 'cornball', 'Puddle-Runner', 'puddle', 'not-a-card', 'puddle-runner:alternate']) {
    assert.equal(elementalStandin(id), referenceStandin(id), id);
    assert.equal(elementalStandin(id), null, id);
  }
  assert.equal(encodes, 0, 'ordinary card and missing-id lookups never build SVG');

  const { getCardImage } = await import('./assets');
  for (const [index, id] of STANDIN_IDS.entries()) {
    for (const variant of [undefined, null, `${id}:alternate`, `${id}:chrome`]) {
      assert.equal(getCardImage(id, variant), expected[index], `${id} / ${variant}`);
    }
  }
  assert.equal(encodes, 0, 'the production card-image path reuses the same artwork regardless of variant');
});
