import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const viewports = [
  { width: 390, height: 844 },
  { width: 471, height: 956 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
];
const browserTypes = [['chromium', chromium]];
if (process.env.BROWSER !== 'chromium' && existsSync(webkit.executablePath())) browserTypes.push(['webkit', webkit]);

for (const [browserName, browserType] of browserTypes) {
  const browser = await browserType.launch();
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      const url = `${origin}/e2e/result-stage.fixture.html?flow=online&result=ranked-draw`;
      await page.goto(url);
      const panel = page.getByTestId('park-result-dialog');
      await panel.waitFor();
      const title = panel.getByRole('heading', { name: 'DEAD HEAT.' });
      const scene = panel.locator('.park-result-scene');
      const primary = panel.getByRole('button', { name: 'Back to Fade Park' });
      const inspect = panel.getByRole('button', { name: 'Inspect final board' });
      const close = panel.getByRole('button', { name: 'Close result' });

      assert.equal(await panel.count(), 1, 'The real ParkResult must render exactly once');
      assert.ok(await title.isVisible(), 'Ranked draw header must be visible');
      assert.ok(await scene.isVisible(), 'Result artwork must be visible');
      assert.ok(await panel.getByTestId('ranked-result').getByText('+5 RP').isVisible(), 'Rank reward status must be preserved');
      assert.ok(await scene.locator('img:not(.park-result-outcome-mark)').evaluate(img => img.complete && img.naturalWidth > 0), 'Result character art must load');

      const geometry = await panel.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const visual = window.visualViewport;
        const viewport = {
          left: visual?.offsetLeft ?? 0,
          top: visual?.offsetTop ?? 0,
          width: visual?.width ?? innerWidth,
          height: visual?.height ?? innerHeight,
        };
        return {
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
          viewport,
          position: getComputedStyle(element).position,
        };
      });
      const { rect, viewport: visual } = geometry;
      assert.equal(geometry.position, 'fixed', 'ParkResult must remain viewport-fixed');
      assert.ok(rect.left >= visual.left - 1 && rect.right <= visual.left + visual.width + 1, `Panel exceeds visual viewport horizontally at ${viewport.width}x${viewport.height}`);
      assert.ok(rect.top >= visual.top - 1 && rect.bottom <= visual.top + visual.height + 1, `Panel exceeds visual viewport vertically at ${viewport.width}x${viewport.height}`);
      assert.ok(Math.abs((rect.left + rect.right) / 2 - (visual.left + visual.width / 2)) <= 2, 'Panel must be horizontally centered');
      assert.ok(Math.abs((rect.top + rect.bottom) / 2 - (visual.top + visual.height / 2)) <= 2, 'Panel must be vertically centered');

      const hittable = locator => locator.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return rect.top >= 0 && rect.bottom <= innerHeight && (hit === element || element.contains(hit));
      });
      assert.ok(await hittable(primary), `Primary action must be above the fold at ${viewport.width}x${viewport.height}`);
      await inspect.click({ trial: true });

      const board = page.getByTestId('transformed-result-parent');
      await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.ok(await hittable(close), 'Sticky close must remain reachable after panel scrolling');
      await close.click();
      await page.getByRole('button', { name: 'View result' }).waitFor();
      await board.evaluate(element => { element.scrollTop = Math.floor(element.scrollHeight * .45); });
      const boardScroll = await board.evaluate(element => element.scrollTop);

      for (let reopen = 0; reopen < 2; reopen += 1) {
        await page.getByRole('button', { name: 'View result' }).click();
        const reopened = page.getByTestId('park-result-dialog');
        await reopened.waitFor();
        assert.equal(await reopened.evaluate(element => element.scrollTop), 0, 'Reopened result must start at its header');
        assert.equal(await board.evaluate(element => element.scrollTop), boardScroll, 'Opening the portal must not move its transformed ancestor');
        await reopened.getByRole('button', { name: 'Inspect final board' }).scrollIntoViewIfNeeded();
        await reopened.getByRole('button', { name: 'Inspect final board' }).click({ trial: true });
        await reopened.getByRole('button', { name: 'Inspect final board' }).click();
      }

      await page.getByRole('button', { name: 'View result' }).click();
      const finalPanel = page.getByTestId('park-result-dialog');
      await finalPanel.getByRole('button', { name: 'Back to Fade Park' }).scrollIntoViewIfNeeded();
      assert.ok(await hittable(finalPanel.getByRole('button', { name: 'Back to Fade Park' })), 'Exit action must remain reachable');
      await finalPanel.getByRole('button', { name: 'Back to Fade Park' }).click();
      assert.equal(await page.evaluate(() => document.body.dataset.action), 'Online exit');
      await page.screenshot({ path: `screenshots/park-result-${browserName}-${viewport.width}x${viewport.height}.png` });
      await page.close();
    }
    for (const timeoutCase of [
      { seat: 'player', reason: 'Your turn clock expired. You forfeited the fade.', districts: ['2', '1'], award: '-15 RP' },
      { seat: 'cpu', reason: "Your rival's turn clock expired. You win by forfeit.", districts: ['1', '2'], award: '+25 RP' },
    ]) {
      for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
        const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
        await page.goto(`${origin}/e2e/result-stage.fixture.html?flow=online&result=timeout&seat=${timeoutCase.seat}`);
        const panel = page.getByTestId('park-result-dialog');
        const reason = panel.getByTestId('timeout-result-reason');
        await reason.waitFor();
        assert.equal(await reason.innerText(), timeoutCase.reason, `${timeoutCase.seat} must see the correct timeout perspective`);
        assert.equal(await panel.getByTestId('timeout-score-context').innerText(), 'District totals show the final board; the timeout decided the winner.');
        const score = panel.locator('.park-result-score');
        assert.deepEqual(await score.locator('b').allInnerTexts(), timeoutCase.districts, 'Final district totals remain visible, including a leading timed-out player');
        assert.ok(await panel.getByTestId('ranked-result').getByText(timeoutCase.award).isVisible(), 'Timeout result preserves the ranked RP award');
        for (const locator of [reason, score, panel.getByTestId('timeout-score-context'), panel.getByTestId('ranked-result')]) {
          assert.ok(await locator.isVisible(), `Timeout explanation, board score, and RP must remain visible at ${viewport.width}px`);
          const bounds = await locator.boundingBox();
          assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, `Result content must fit the viewport at ${viewport.width}px`);
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

console.log(`ParkResult visual viewport and reopen behavior verified in ${browserTypes.map(([name]) => name).join(' and ')}.`);