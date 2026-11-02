import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const text = (file: string) =>
  readFileSync(new URL(file, import.meta.url), 'utf8');
test('production mode imports canonical catalog and has no lab or fake reward dependency', () => {
  const arena = text('./BreakthroughArena.tsx'),
    result = text('./ResultStage.tsx'),
    page = text('../../pages/game/Breakthrough.tsx');
  assert.doesNotMatch(
    arena,
    /deckLab|crewLoadout|SCENARIOS|scenarioFactory|exportTrace|useAuditionPerformance|pendingAction|confirmAction/,
  );
  assert.doesNotMatch(result, /awardRank|rankedStats|previewRank|590/);
  assert.match(page, /buildBreakthroughRoster/);
  assert.match(page, /usePersistentDeckSelection/);
  assert.match(arena, /preferredReducedMotion \|\| osReducedMotion/);
});
test('nested routes precede Kumite hub and Breakthrough stays outside eager idle warmup', () => {
  const routes = text('../../pages/game/GameApp.tsx'),
    modules = text('../../pages/game/routeModules.ts');
  assert(
    routes.indexOf('path="/game/kumite/breakthrough"') <
      routes.indexOf('path="/game/kumite"'),
  );
  assert.match(modules, /Breakthrough: \(\) => import\('\.\/Breakthrough'\)/);
  assert.match(modules, /key !== 'Breakthrough'/);
});

test('Kumite opens PvP matchmaking and legacy practice links redirect to it', () => {
  const page = text('../../pages/game/Breakthrough.tsx'), hub = text('../../pages/game/Kumite.tsx');
  assert.match(page, /getBreakthroughLaunchReadiness\(\)\.canLaunch/);
  assert.ok(page.includes(`if (location === '/game/kumite/breakthrough/practice') return <Redirect to="/game/kumite/breakthrough" />;`));
  assert.ok(hub.includes('href="/game/kumite/breakthrough"'));
  assert.ok(hub.includes('Find opponent'));
  assert.doesNotMatch(hub, /CPU PRACTICE|Practice Breakthrough|Face the rivals/);
});
