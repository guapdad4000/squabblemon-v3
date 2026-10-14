import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { computeElementalOverdrivePerk } from '../../../lib/squabblemon-engine/src/bossRaid';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('computeElementalOverdrivePerk returns distinct elemental power-ups for Air, Fire/Light, Earth, and Electric', () => {
  const air = computeElementalOverdrivePerk('Air');
  assert.equal(air.perkName, 'TAILWIND SURGE');

  const fire = computeElementalOverdrivePerk('Fire');
  assert.equal(fire.perkName, 'SOLAR SCORCH');

  const earth = computeElementalOverdrivePerk('Earth');
  assert.equal(earth.perkName, 'IRON STANCE');

  const electric = computeElementalOverdrivePerk('Electric');
  assert.equal(electric.perkName, 'HIGH VOLTAGE');
});

test('CardView marks 10+ Hands board characters with data-awakened="true" and card-finish.css styles the Awakening Aura', () => {
  const cardView = readFileSync(path.join(sqRoot, 'src/components/CardView.tsx'), 'utf8');
  const cardFinishCss = readFileSync(path.join(sqRoot, 'src/components/card-finish.css'), 'utf8');

  assert.match(cardView, /data-awakened=\{isBoard\s*&&\s*displayPower\s*>=\s*10/);
  assert.match(cardFinishCss, /\.collector-card\[data-awakened="true"\]/);
});

test('BossRaidView and Battle render Elemental Overdrive Perks and Awakening Banner Cut-In', () => {
  const bossRaidView = readFileSync(path.join(sqRoot, 'src/components/fadecade/BossRaidView.tsx'), 'utf8');
  const battleView = readFileSync(path.join(sqRoot, 'src/components/Battle.tsx'), 'utf8');

  assert.match(bossRaidView, /computeElementalOverdrivePerk/);
  assert.match(bossRaidView, /raid-overdrive-perk/);
  assert.match(battleView, /battle-overdrive-banner/);
});
