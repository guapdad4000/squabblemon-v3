import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Dedicated dev instrumentation measures the real CardView render/commit body;
// no wrapper memo, HTML stand-in or production-source instrumentation is used.
const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.ONLINE_PROJECTION_OUTPUT ?? '/tmp/online-projection';
process.env.PORT ??= '4338';
process.env.BASE_PATH = '/';
process.env.VITE_E2E_AUTH = 'true';
await mkdir(output, { recursive: true });
const baseline = process.env.ONLINE_PROJECTION_BASELINE === '1';
let projectionSourceHash;
let instrumented = false;
const server = await createServer({
  root, configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  cacheDir: `/tmp/squabblemon-online-projection-${process.pid}`, logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  plugins: [{ name: 'online-projection-card-commit-counter', enforce: 'pre', transform(source, id) {
    if (id.split('?')[0].endsWith('/src/components/MultiplayerBattle.tsx')) {
      const code = baseline ? execFileSync('git', ['show', 'HEAD:artifacts/squabblemon/src/components/MultiplayerBattle.tsx'], { cwd: root, encoding: 'utf8' }) : source;
      projectionSourceHash = createHash('sha256').update(code).digest('hex');
      return { code, map: null };
    }
    if (!id.split('?')[0].endsWith('/src/components/CardView.tsx')) return;
    const marker = '  card = presentCardForm(card);';
    assert.equal(source.split(marker).length, 2, 'CardView instrumentation marker must be unique');
    instrumented = true;
    return { code: source.replace(marker, `
  const diagnostic = { id: 'instanceId' in card ? card.instanceId : card.id, zone: isBoard ? 'board' : 'hand', cost };
  (window as any).__onlineCardDiagnostic?.renders.push(diagnostic);
  React.useLayoutEffect(() => { (window as any).__onlineCardDiagnostic?.commits.push(diagnostic); });
${marker}`), map: null };
  } }],
});
let browser;
const report = { baseline, kind: 'actual online hook/battle/card fixture, mocked local GETs; not production/device performance', checks: [] };
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors = []; report.errors = errors;
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket('**', socket => socket.close());
  await page.addInitScript(() => {
    window.__onlineCardDiagnostic = { renders: [], commits: [] };
    localStorage.setItem('squabblemon_feedback', JSON.stringify({ audioEnabled: false, hapticsEnabled: false, reducedMotion: false }));
  });
  await page.goto(`${origin}e2e/online-projection.fixture.html`, { waitUntil: 'domcontentloaded' });
  const board = page.locator('[data-card-zone="board"]');
  await expect(board).toHaveCount(10);
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-connected', 'true');
  await page.waitForTimeout(1400);
  assert(instrumented, 'actual CardView source was instrumented');
  const initial = await page.evaluate(() => window.__onlineCardDiagnostic.commits.filter(row => row.zone === 'board'));
  assert.equal(new Set(initial.map(row => row.id)).size, 10, 'counter sees all ten mounted production board cards');
  const reset = () => page.evaluate(() => { window.__onlineCardDiagnostic = { renders: [], commits: [] }; });
  const sample = () => page.evaluate(() => ({ ...window.__onlineCardDiagnostic, snapshot: window.onlineProjectionFixture.snapshot(), timer: document.querySelector('[aria-label="Turn time remaining"]')?.getAttribute('aria-valuenow') }));
  await reset();
  const before = await sample();
  await page.waitForTimeout(2700);
  const heartbeat = await sample();
  assert(heartbeat.snapshot.reads >= before.snapshot.reads + 3, 'at least three real800ms poll responses arrived');
  assert(Number(heartbeat.timer) < Number(before.timer), 'actual visible turn clock continued decreasing');
  if (baseline) {
    assert(heartbeat.commits.filter(row => row.zone === 'board').length >= 30, 'old projection reproduces all ten card commits on three heartbeats');
    report.checks.push({ name: 'baseline-clock-only-heartbeats', ...heartbeat });
    report.status = 'passed';
    console.log('PASS baseline: old projection reproduces repeated board commits');
    await writeFile(`${output}/report.json`, JSON.stringify({ ...report, projectionSourceHash }, null, 2));
    process.exitCode = 0;
  } else {
  assert.equal(heartbeat.renders.filter(row => row.zone === 'board').length, 0, 'clock-only polls do not render CardView board bodies');
  assert.equal(heartbeat.commits.filter(row => row.zone === 'board').length, 0, 'clock-only polls do not commit board cards');
  report.checks.push({ name: 'clock-only-heartbeats', ...heartbeat });

  await reset();
  await page.evaluate(() => window.onlineProjectionFixture.update('deadline'));
  await expect(page.locator('[aria-label="Turn time remaining"]')).toHaveAttribute('aria-valuenow', /4[34-5]/);
  const deadline = await sample();
  assert.equal(deadline.commits.filter(row => row.zone === 'board').length, 0, 'authoritative deadline correction does not repaint cards');
  report.checks.push({ name: 'deadline-correction', ...deadline });

  await reset();
  await page.evaluate(() => window.onlineProjectionFixture.update('card'));
  const cardId = heartbeat.snapshot.boardId;
  await expect(page.locator(`[data-card-zone="board"][data-instance-id="${cardId}"]`)).toContainText('Confirmed form');
  const correction = await sample();
  assert.equal(correction.snapshot.revision, before.snapshot.revision, 'same-revision correction really exercised');
  assert.deepEqual([...new Set(correction.commits.filter(row => row.zone === 'board').map(row => row.id))], [cardId], 'only corrected board card commits');
  report.checks.push({ name: 'same-revision-card-form-and-status', ...correction });

  // Hand faces show their printed base cost until a district is selected.
  // Select a real district before checking an authoritative lane-cost update.
  await page.locator(`[data-card-zone="hand"][data-instance-id="${heartbeat.snapshot.handId}"]`).click();
  await page.getByTestId('lane-0').click();
  await page.waitForTimeout(250);
  await reset();
  await page.evaluate(() => window.onlineProjectionFixture.update('private-cost'));
  await expect(page.locator(`[data-card-zone="hand"][data-instance-id="${heartbeat.snapshot.handId}"]`)).toHaveAttribute('data-card-cost', '0');
  const privateCost = await sample();
  assert(privateCost.commits.some(row => row.zone === 'hand' && row.id === heartbeat.snapshot.handId && row.cost === 0), 'actual hand face commits the new private cost');
  assert.equal(privateCost.commits.filter(row => row.zone === 'board').length, 0, 'private cost update does not repaint unaffected board');
  report.checks.push({ name: 'same-revision-private-cost', ...privateCost });

  await page.screenshot({ path: `${output}/ten-card-online-board.png` });
  await reset();
  await page.evaluate(() => window.onlineProjectionFixture.update('status'));
  await expect(page.getByTestId('online-battle')).toHaveAttribute('data-status', 'complete');
  await expect(page.locator('[aria-label="Turn time remaining"]')).toHaveCount(0);
  const complete = await sample();
  assert.equal(complete.snapshot.writes, 0);
  assert.deepEqual(errors, []);
  report.checks.push({ name: 'authoritative-complete-status', ...complete });
  report.status = 'passed';
  console.log('PASS online projection: ten actual board cards, heartbeat/deadline zero board renders, fresh form/private cost/status');
  }
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ ...report, projectionSourceHash }, null, 2));
  await browser?.close(); await server.close();
}
