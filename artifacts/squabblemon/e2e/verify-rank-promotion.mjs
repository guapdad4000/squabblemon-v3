import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:43247';
const output = process.env.RANK_PROMOTION_OUTPUT ?? fileURLToPath(new URL('../../deliverables/kumite-tier-patch-20261013/browser/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const report = { complete: false, evidence: 'Actual exported ParkResult and RankUpReward components, source-backed rankProgress/milestone rewards; local prop fixtures, not a deployed ranked match.', checks: [] };
const videoName = 'squabblehouse-openart-cinematic-v1';
const isCinematicMedia = request => request.resourceType() === 'media' && new URL(request.url()).pathname.includes(videoName) && new URL(request.url()).pathname.endsWith('.mp4');

async function capture(page, file) {
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter(image => image.getBoundingClientRect().width > 0).map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: `${output}/${file}` });
}
async function expectOrdinary(page) {
  await page.getByTestId('park-result-dialog').waitFor();
  assert.equal(await page.getByTestId('rank-promotion').count(), 0);
  assert.equal(await page.getByTestId('rank-promotion-dialog').count(), 0);
  assert.equal(await page.locator('.park-rank-review').count(), 0);
  assert.equal(await page.locator('video').count(), 0);
  const geometry = await page.getByTestId('park-result-dialog').evaluate(element => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewportWidth + 1 && geometry.top >= -1 && geometry.bottom <= geometry.viewportHeight + 1, 'Ordinary result fits viewport');
}
async function keepSpot(page) {
  await page.getByRole('button', { name: 'KEEP MY SPOT' }).click();
  await page.getByTestId('park-result-dialog').waitFor();
  assert.equal(await page.getByTestId('rank-promotion').count(), 0);
}
async function setScenario(page, name, resultKey) {
  await page.evaluate(({ name, resultKey }) => window.rankPromotionFixture.setScenario(name, resultKey), { name, resultKey });
  await page.locator(`[data-testid="rank-promotion-fixture"][data-scenario="${name}"]`).waitFor();
}

try {
  for (const [viewportName, width, height] of [['phone', 390, 844], ['desktop', 1440, 960]]) {
    for (const reduced of [false, true]) {
      const label = `${viewportName}-${reduced ? 'reduce' : 'motion'}`;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await context.addInitScript(() => {
        // Stable fast-connection capability for the optional video check.
        Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: false, effectiveType: '4g', downlink: 10 } });
      });
      const errors = [], ordinaryCases = [];
      for (const name of ['same-tier-win', 'catch-up-gift', 'same-tier-loss', 'same-tier-draw', 'demotion', 'unranked', 'missing-rank']) {
        const page = await context.newPage(), media = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (isCinematicMedia(request)) media.push(request.url()); });
        await page.goto(`${origin}/e2e/rank-promotion.fixture.html?case=${name}&motion=${reduced ? 'reduce' : 'full'}&key=${encodeURIComponent(`${label}:${name}`)}`);
        await expectOrdinary(page);
        await page.waitForTimeout(150);
        assert.equal(media.length, 0, `${name} never requests the cinematic video`);
        if (name === 'catch-up-gift' || name === 'unranked') {
          assert.equal(await page.getByTestId('saved-rank-rewards').count(), 1, 'Saved grants remain visible without opening a tier cinematic');
          assert.match(await page.getByTestId('saved-rank-rewards').innerText(), /250 Clout.*1 tickets.*15 shards/);
        }
        if (['same-tier-win', 'catch-up-gift', 'same-tier-loss', 'same-tier-draw'].includes(name)) await capture(page, `${label}-${name}.png`);
        ordinaryCases.push({ name, cinematic: false, manualReview: false, videoRequests: media.length });
        await page.close();
      }
      const page = await context.newPage(), videoRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (isCinematicMedia(request)) videoRequests.push(request.url()); });
      const keyA = `${label}:room-A:1:player`;
      const keyB = `${label}:room-A:2:player`;
      await page.goto(`${origin}/e2e/rank-promotion.fixture.html?case=promotion-win&motion=${reduced ? 'reduce' : 'full'}&key=${encodeURIComponent(keyA)}`);
      await page.getByTestId('rank-promotion').waitFor();
      assert.equal(await page.locator('.rank-promotion__haul article').count(), 1);
      assert.match(await page.locator('.rank-promotion__hero > strong').innerText(), /Bronze/i);
      if (reduced) assert.equal(await page.locator('.rank-promotion__cinema video').count(), 0);
      else {
        await page.waitForFunction(() => !!document.querySelector('.rank-promotion__cinema video'));
        await page.waitForFunction(() => !!document.querySelector('.rank-promotion__cinema video')?.readyState);
        assert.ok(videoRequests.length > 0, 'An eligible full-motion promotion requests the exact cinematic');
      }
      await capture(page, `${label}-promotion.png`);
      await keepSpot(page);
      assert.equal(await page.locator('.park-rank-review').count(), 1, 'Genuine promotion supports manual review');
      await page.locator('.park-rank-review').click();
      await page.getByTestId('rank-promotion').waitFor();
      await keepSpot(page);
      await page.evaluate(() => window.rankPromotionFixture.remount());
      await page.getByTestId('park-result-dialog').waitFor();
      assert.equal(await page.getByTestId('rank-promotion').count(), 0, 'Acknowledged result remount does not replay automatically');
      await page.reload();
      await page.getByTestId('park-result-dialog').waitFor();
      assert.equal(await page.getByTestId('rank-promotion').count(), 0, 'Reconnect/reload deduplicates this settled match key');
      // Same RP boundary, different match identity: a re-promotion remains a
      // promotion even though this season already paid its gift.
      await setScenario(page, 'promotion-no-gift', keyB);
      await page.getByTestId('rank-promotion').waitFor();
      assert.equal(await page.locator('.rank-promotion__haul article').count(), 0);
      assert.match(await page.locator('.rank-promotion__haul').innerText(), /no new gift/);
      await capture(page, `${label}-repromotion-no-gift.png`);
      await setScenario(page, 'promotion-silver', `${label}:room-B:2:player`);
      await page.getByTestId('rank-promotion').waitFor();
      await page.waitForTimeout(300);
      assert.equal(await page.getByTestId('rank-promotion').count(), 1, 'Late cleanup of the previous promotion cannot dismiss a new match promotion');
      assert.match(await page.locator('.rank-promotion__hero > strong').innerText(), /Silver/i);
      // Replace an open promotion directly with an ordinary next result. This
      // must not keep the previous presentation open through stale local state.
      await setScenario(page, 'same-tier-win', `${label}:room-A:3:player`);
      await expectOrdinary(page);
      await setScenario(page, 'catch-up-gift', `${label}:room-A:4:player`);
      await expectOrdinary(page);
      assert.equal(await page.getByTestId('saved-rank-rewards').count(), 1);
      await setScenario(page, 'promotion-draw', `${label}:room-A:5:player`);
      await page.getByTestId('rank-promotion').waitFor();
      await keepSpot(page);
      assert.ok(await page.getByRole('heading', { name: 'DEAD HEAT.' }).isVisible());
      await setScenario(page, 'promotion-silver', `${label}:room-A:6:player`);
      await page.getByTestId('rank-promotion').waitFor();
      assert.match(await page.locator('.rank-promotion__hero > strong').innerText(), /Silver/i);
      await keepSpot(page);
      await setScenario(page, 'same-tier-loss', `${label}:room-A:7:player`);
      await expectOrdinary(page);
      assert.equal(await page.locator('.park-rank-review').count(), 0);
      const unacknowledgedKey = `${label}:room-A:8:player`;
      await setScenario(page, 'promotion-no-gift', unacknowledgedKey);
      await page.getByTestId('rank-promotion').waitFor();
      await page.evaluate(() => window.rankPromotionFixture.remount());
      await page.getByTestId('park-result-dialog').waitFor();
      assert.equal(await page.getByTestId('rank-promotion').count(), 0, 'First presentation deduplicates an unacknowledged remount');
      await page.locator('.park-rank-review').click();
      await page.getByTestId('rank-promotion').waitFor();
      await page.getByTestId('rank-promotion-dialog').getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Reopen result', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Reopen result', exact: true }).click();
      await page.getByTestId('park-result-dialog').waitFor();
      assert.equal(await page.getByTestId('rank-promotion').count(), 0, 'Generic close and reopen does not replay the cinematic');
      const reloadKey = `${label}:room-A:9:player`;
      await page.goto(`${origin}/e2e/rank-promotion.fixture.html?case=promotion-no-gift&motion=${reduced ? 'reduce' : 'full'}&key=${encodeURIComponent(reloadKey)}`);
      await page.getByTestId('rank-promotion').waitFor();
      await page.reload();
      await page.getByTestId('park-result-dialog').waitFor();
      assert.equal(await page.getByTestId('rank-promotion').count(), 0, 'First presentation deduplicates a reconnect before acknowledgement');
      await page.locator('.park-rank-review').click();
      await page.getByTestId('rank-promotion').waitFor();
      await keepSpot(page);
      assert.deepEqual(errors, []);
      report.checks.push({ viewport: label, width, height, reduced, strictMode: true, ordinaryCases, genuinePromotion: true, drawPromotion: true, repromotionWithoutGift: true, keepSpotShowsNormalResult: true, genuineOnlyManualReview: true, sameMatchRemountDeduplicated: true, reloadDeduplicated: true, unacknowledgedRemountDeduplicated: true, unacknowledgedReconnectDeduplicated: true, genericCloseAndReopenDeduplicated: true, manualReviewAfterDedup: true, sameBoundaryDifferentMatchPromotes: true, openPromotionToNewPromotionPropTransition: true, lateCleanupCannotDismissNewPromotion: true, openPromotionToOrdinaryPropTransition: true, fullMotionVideoRequests: videoRequests.length, errors });
      console.log(`${label}: ordinary/backfilled/loss/draw/unranked gating, genuine tiers, no-gift re-promotion, match-key dedup, transitions and video checks passed.`);
      await context.close();
    }
  }
  report.complete = true;
} catch (error) { report.failure = String(error.stack ?? error); throw error; }
finally { await browser.close(); await writeFile(`${output}/verification.json`, JSON.stringify(report, null, 2)); }
