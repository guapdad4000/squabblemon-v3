import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { KUMITE_BOSS_FORMS, computeHandsOverdrive } from '../../../lib/squabblemon-engine/src/bossRaid';
import { KUMITE_LINEUP_REWARDS } from '../../../lib/squabblemon-engine/src/kumiteCards';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('P. Tang (p-tang) is included in KUMITE_LINEUP_REWARDS and KUMITE_BOSS_FORMS', () => {
  assert.ok(KUMITE_LINEUP_REWARDS.some((r) => r.cardId === 'p-tang'), 'Expected p-tang in KUMITE_LINEUP_REWARDS');
  assert.ok(KUMITE_BOSS_FORMS.some((f) => f.fighterId === 'p-tang'), 'Expected p-tang in KUMITE_BOSS_FORMS');
});

test('computeHandsOverdrive calculates 3-tier Hands power-up thresholds (12 / 20 / 30 Hands)', () => {
  const tier0 = computeHandsOverdrive(8);
  assert.equal(tier0.tier, 0);
  assert.equal(tier0.bonusPct, 0);

  const tier1 = computeHandsOverdrive(14);
  assert.equal(tier1.tier, 1);
  assert.equal(tier1.label, 'STREET SURGE');
  assert.equal(tier1.bonusPct, 15);

  const tier2 = computeHandsOverdrive(22);
  assert.equal(tier2.tier, 2);
  assert.equal(tier2.label, 'BELT CHECK');
  assert.equal(tier2.bonusPct, 30);

  const tier3 = computeHandsOverdrive(32);
  assert.equal(tier3.tier, 3);
  assert.equal(tier3.label, 'MAX OVERDRIVE');
  assert.equal(tier3.bonusPct, 50);
});

test('BossRaidView and boss-raid-design.css render Hands Overdrive bar and Character Banner Cut-In (.raid-overdrive-cutin)', () => {
  const bossRaidView = readFileSync(path.join(sqRoot, 'src/components/fadecade/BossRaidView.tsx'), 'utf8');
  const bossRaidDesignCss = readFileSync(path.join(sqRoot, 'src/styles/boss-raid-design.css'), 'utf8');

  assert.match(bossRaidView, /raid-overdrive-bar/);
  assert.match(bossRaidView, /raid-overdrive-cutin/);
  assert.match(bossRaidDesignCss, /\.raid-overdrive-cutin/);
  assert.match(bossRaidDesignCss, /\.raid-overdrive-bar/);
});
