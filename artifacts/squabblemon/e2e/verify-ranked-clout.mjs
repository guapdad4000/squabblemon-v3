import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.REVIEW_OUTPUT ?? '/home/falcon/Documents/New project 9/output/v2-qa5/ranked-clout';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const report = { evidence: 'Actual ParkResult and RankUpReward in local receipt-prop fixtures. Native PostgreSQL settlement/cap tests are separate; this does not claim deployed multiplayer proof.', checks: [] };
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const [scenario, expected, status] of [['win', '+50 Clout', 'saved'], ['draw', '+20 Clout', 'saved'], ['loss', '+10 Clout', 'saved'], ['cap', 'Daily match Clout limit reached.', 'daily-limit'], ['bot', 'Match Clout comes from completed human ranked fades.', 'ineligible'], ['promotion', '+50 Clout', 'saved']]) {
      await page.goto(`${origin}/e2e/rank-promotion.fixture.html?case=match-clout-${scenario}&motion=reduce&key=${viewport.width}:${scenario}`);
      const grant = page.getByTestId('ranked-match-clout'); await grant.waitFor();
      assert.equal(await grant.count(), 1); assert.equal(await grant.getAttribute('data-status'), status);
      assert.match(await grant.innerText(), new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(await grant.getAttribute('data-receipt-id'), 'ranked-clout:fixture-room:1:player');
      const dialog = page.getByRole('dialog');
      assert.ok(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 && el.scrollWidth <= el.clientWidth + 2; }), 'result fits viewport without horizontal overflow');
      await grant.scrollIntoViewIfNeeded();
      const bounds = await grant.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
      if (status === 'saved') {
        assert.match(await grant.innerText(), /payout 3\/5.*2026-10-24 UTC/);
        const glyph = grant.locator('img'); await glyph.waitFor();
        await glyph.evaluate(img => img.decode()); assert.ok(await glyph.evaluate(img => img.naturalWidth > 0));
      } else if (status === 'daily-limit') assert.match(await grant.innerText(), /5\/5 payouts on 2026-10-24.*2026-10-25 at 00:00 UTC/s);
      if (status !== 'ineligible') {
        const contrast = await grant.evaluate(el => {
          const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
          const luminance = values => values.map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
          const bg = luminance(rgb(getComputedStyle(el).backgroundColor));
          return [...el.querySelectorAll('strong,small')].map(node => {
            const style = getComputedStyle(node), fg = luminance(rgb(style.webkitTextFillColor || style.color));
            return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05);
          });
        });
        assert.ok(contrast.every(ratio => ratio >= 4.5), `Receipt text contrast: ${contrast.join(', ')}`);
      }
      if (scenario === 'promotion') {
        assert.equal(await page.locator('.rank-promotion__haul article').count(), 1);
        assert.match(await page.locator('.rank-promotion__haul article').innerText(), /250.*Clout/s, 'rank milestone stays distinct from match payout');
        assert.equal(await page.locator('video').count(), 0, 'reduced motion keeps the promotion poster');
      }
      if (['win', 'cap', 'promotion'].includes(scenario)) await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}-${scenario}.png` });
      if (scenario === 'promotion') {
        const done = page.getByRole('button', { name: 'KEEP MY SPOT' }); await done.scrollIntoViewIfNeeded(); await done.click();
        await page.getByTestId('park-result-dialog').waitFor(); assert.equal(await page.getByTestId('ranked-match-clout').count(), 1);
      }
      const exit = page.getByRole('button', { name: 'Back to Fade Park', exact: true }); await exit.scrollIntoViewIfNeeded(); await exit.click();
      await page.getByRole('button', { name: 'Reopen result' }).click(); await page.getByTestId('park-result-dialog').waitFor();
      assert.equal(await page.getByTestId('ranked-match-clout').count(), 1, 'reopening reads the same receipt');
      assert.equal(await page.getByTestId('rank-promotion').count(), 0, 'reopening does not replay a promotion');
      await page.getByRole('button', { name: 'Inspect final board', exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Inspect final board', exact: true }).click();
      report.checks.push({ viewport, scenario, status, amountLabel: expected, receiptId: 'ranked-clout:fixture-room:1:player', actions: true });
    }
    await page.goto(`${origin}/e2e/rank-promotion.fixture.html?case=same-tier-win&motion=reduce`);
    await page.getByTestId('park-result-dialog').waitFor(); assert.equal(await page.getByTestId('ranked-match-clout').count(), 0, 'legacy receipts never invent a payout');
    assert.deepEqual(errors, []); await page.close();
  }
  report.complete = true;
} finally { await browser.close(); await writeFile(`${output}/ranked-clout.json`, JSON.stringify(report, null, 2)); }
console.log(`Ranked Clout receipt UI: ${report.checks.length} cases passed, browser closed.`);
