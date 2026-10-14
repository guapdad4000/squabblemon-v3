import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const battleSource = readFileSync(new URL('./Battle.tsx', import.meta.url), 'utf8');
const battleEffectsSource = readFileSync(new URL('./BattleEffects.tsx', import.meta.url), 'utf8');
const cardViewSource = readFileSync(new URL('./CardView.tsx', import.meta.url), 'utf8');
const battleFormationSource = readFileSync(new URL('./BattleFormation.tsx', import.meta.url), 'utf8');

test('PowerScore, handDraw, DistrictEffects, MotionEnergy, and BattleBurst do not call setState during render or expiration timeouts', () => {
  assert.doesNotMatch(battleSource, /if\s*\(change\.value\s*!==\s*value\)\s*setChange/);
  assert.doesNotMatch(battleSource, /if\s*\(handDraw\.identity\s*!==\s*handIdentity\)\s*\{[\s\S]{0,240}setHandDraw/);
  assert.doesNotMatch(battleEffectsSource, /useState/);
});

test('CardView does not attach unpaired instanceId as layoutId and skips motion wrapper for static presentation cards', () => {
  assert.doesNotMatch(cardViewSource, /layoutId=\{inspectionLayout\s*\?\?\s*\(disableLayout\s*\?\s*undefined\s*:\s*instance\?\.instanceId\)\}/);
  assert.match(cardViewSource, /layoutId:\s*inspectionLayout/);
  assert.match(cardViewSource, /const useStaticShell = Boolean\(presentationOnly && disableLayout && !inspectionLayout\)/);
});

test('Battle only attaches inspectionLayout when interactive or reviewingFinalBoard and BattleFormation does not tear down observers on count change', () => {
  assert.match(battleSource, /inspectionLayout:\s*reducedMotion\s*\|\|\s*\(!interactive\s*&&\s*!reviewingFinalBoard\)\s*\?\s*undefined\s*:\s*'battle-inspect-'\s*\+\s*card\.instanceId/);
  assert.match(battleFormationSource, /\},\s*\[\]\);/);
});
