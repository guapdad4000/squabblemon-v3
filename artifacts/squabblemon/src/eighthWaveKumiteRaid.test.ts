import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  BOSS_FORMS,
  KUMITE_BOSS_FORMS,
  bossFormForMode,
  createBossRaid,
  bossBlastPreview,
} from '../../../lib/squabblemon-engine/src/bossRaid';
import { KUMITE_CARD_REWARDS } from '../../../lib/squabblemon-engine/src/kumiteCards';
import { ROOKIE_CORE_IDS } from '../../../lib/squabblemon-engine/src/data';

const sqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Engine bossRaid supports both precinct and kumite 5-tier boss forms and preserves kumite unlock linkage', () => {
  assert.equal(BOSS_FORMS.length, 5);
  assert.equal(KUMITE_BOSS_FORMS.length, 5);
  assert.equal(bossFormForMode(1, 'precinct').name, 'Patrol Shakedown');
  assert.equal(bossFormForMode(1, 'kumite').fighterId, 'chonk-lee');
  assert.equal(bossFormForMode(5, 'kumite').fighterId, 'sho-nuff');

  const kumiteRun = createBossRaid('test-kumite-run', '2026-10-14', [...ROOKIE_CORE_IDS.slice(0, 10)], 'Dojo Crew', { tier: 1, hp: 1200 }, 'kumite');
  assert.equal(kumiteRun.mode, 'kumite');
  const preview = bossBlastPreview(kumiteRun.match, 1);
  assert.equal(typeof preview.total, 'number');
  assert.equal(KUMITE_CARD_REWARDS.length, 9);
});

test('API kumiteRewards and bossRaid connect Boss Raid completions, 50+ damage wins, and tier clears to Kumite progression', () => {
  const kumiteRewardsApi = readFileSync(path.join(sqRoot, '../api-server/src/lib/kumiteRewards.ts'), 'utf8');
  const bossRaidApi = readFileSync(path.join(sqRoot, '../api-server/src/lib/bossRaid.ts'), 'utf8');
  const bossRaidRoute = readFileSync(path.join(sqRoot, '../api-server/src/routes/bossRaid.ts'), 'utf8');

  assert.match(kumiteRewardsApi, /boss-raid:|bossCampaign/);
  assert.match(bossRaidApi, /reconcileKumiteRewards/);
  assert.match(bossRaidRoute, /req\.query\.mode/);
});

test('BossRaidGame, BossRaidView, Kumite, and KumiteRewards expose Operation Mode Flip, Live Projected Strike, Enrage Phase, and Interactive Dossier', () => {
  const bossRaidGame = readFileSync(path.join(sqRoot, 'src/components/fadecade/BossRaidGame.tsx'), 'utf8');
  const bossRaidView = readFileSync(path.join(sqRoot, 'src/components/fadecade/BossRaidView.tsx'), 'utf8')
    + readFileSync(path.join(sqRoot, 'src/components/fadecade/RaidCinematicHero.tsx'), 'utf8');
  const bossRaidDesignCss = readFileSync(path.join(sqRoot, 'src/styles/boss-raid-design.css'), 'utf8');
  const kumitePage = readFileSync(path.join(sqRoot, 'src/pages/game/Kumite.tsx'), 'utf8');
  const kumiteRewards = readFileSync(path.join(sqRoot, 'src/components/kumite/KumiteRewards.tsx'), 'utf8');

  assert.match(bossRaidGame, /raid-mode-flip/);
  assert.match(bossRaidView, /raid-hp-projected/);
  assert.match(bossRaidView, /raid-projected-strike/);
  assert.match(bossRaidView, /data-boss-phase/);
  assert.match(bossRaidView, /raid-score-tiers/);
  assert.match(bossRaidView, /raid-cinema-meta/);
  assert.match(bossRaidView, /raid-lane-clash-bar/);
  assert.match(bossRaidDesignCss, /\.raid-hp-projected/);
  assert.match(bossRaidDesignCss, /\.raid-mode-flip/);
  assert.match(bossRaidDesignCss, /\.raid-boss-multibar/);
  assert.match(bossRaidDesignCss, /\.raid-lane-clash-bar/);
  assert.match(kumitePage, /punch-on-patrol&raid=kumite/);
  assert.match(kumiteRewards, /kumite-dossier-preview/);
});
