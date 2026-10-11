import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, getMatchDistricts, type Lane } from './gameEngine';
import { DISTRICT_CATALOG, type DistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import { getDistrictBattleCue } from './districtBattleCue';

const snapshot = (): DistrictSnapshot => ({ version: 1, locations: ['bodega', 'pirate-radio', 'construction-site'].map(id => DISTRICT_CATALOG.find(d => d.id === id)!) as DistrictSnapshot['locations'] });
test('broadcast cue follows exact ally count, including overload and excluding hazards', () => {
  const match = createMatch('block', 'combo', undefined, undefined, snapshot());
  for (const count of [0, 1, 2, 3]) {
    match.boards[1] = Array.from({ length: count }, (_, i) => ({ ...createCardInstance('cornball', 'player', 'broadcast', i), lane: 1 as Lane }));
    const cue = getDistrictBattleCue(getMatchDistricts(match)[1], match, 1);
    assert.equal(cue.text, count === 2 ? 'ON AIR' : `${count}/2 allies`);
    assert.equal(cue.state, count === 2 ? 'active' : count > 2 ? 'blocked' : 'progress');
  }
  match.boards[1][2].hazard = true;
  assert.equal(getDistrictBattleCue(getMatchDistricts(match)[1], match, 1).text, 'ON AIR');
});
test('live status uses the issued broadcast threshold and never reinterprets a mismatched rule', () => {
  const issued = snapshot();
  issued.locations[1] = { ...issued.locations[1], rule: 'An issued three-card broadcast.', effect: { kind: 'broadcast', requiredAllies: 3, amount: 2 } };
  const match = createMatch('block', 'combo', undefined, undefined, snapshot());
  match.districtSnapshot = issued;
  const district = getMatchDistricts(match)[1];
  assert.equal(getDistrictBattleCue(district, match, 1).text, '0/3 allies');
  const external = { ...district, rule: 'A server issued different rule', status: 'Authoritative server cue' };
  assert.equal(getDistrictBattleCue(external, match, 1).text, external.status);
});
test('compact ready, spent and closed cues retain their full accessible detail', () => {
  const match = createMatch('block', 'combo', undefined, undefined, snapshot());
  const before = getMatchDistricts(match);
  assert.deepEqual(getDistrictBattleCue(before[0], match, 0), { text: 'Discount ready', state: 'active', detail: 'Your first-play discount ready' });
  match.districtRuntime!.plays.player[0] = 1;
  match.round = 4;
  const after = getMatchDistricts(match);
  assert.equal(getDistrictBattleCue(after[0], match, 0).text, 'Discount spent');
  assert.equal(getDistrictBattleCue(after[2], match, 2).text, 'CLOSED · moves only');
});
