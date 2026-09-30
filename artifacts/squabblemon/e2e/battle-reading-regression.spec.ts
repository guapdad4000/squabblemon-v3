import { expect, test, type Page } from '@playwright/test';

const fixture = (scenario: string) => `/squabblemon/e2e/battle-reading-regression.fixture.html?scenario=${scenario}`;
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 600 },
  { width: 1366, height: 768 },
];
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inViewport = (b: Box, vp: { width: number; height: number }) => b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1;
const state = (page: Page) => page.evaluate(() => window.__readingFixture);

async function hitTestable(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
}

for (const vp of viewports) {
  test.describe(`battle reading ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('mechanic lesson portrait is bounded, never overlaps text, and dismiss fires', async ({ page }, info) => {
      await page.goto(fixture('lesson'));
      const lesson = page.getByTestId('mechanic-lesson');
      await expect(lesson).toBeVisible();
      const card = lesson.locator('.mechanic-lesson-card');
      const portrait = lesson.locator('.mechanic-lesson-portrait');
      const img = portrait.locator('img.dr-fade-referee');
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
      const cardBox = (await card.boundingBox())!;
      const portraitBox = (await portrait.boundingBox())!;
      const imgBox = (await img.boundingBox())!;
      expect(inViewport(cardBox, vp), 'lesson card fits the viewport').toBe(true);
      expect(imgBox.x).toBeGreaterThanOrEqual(portraitBox.x - 1);
      expect(imgBox.x + imgBox.width).toBeLessThanOrEqual(portraitBox.x + portraitBox.width + 1);
      for (const sel of ['#mechanic-lesson-title', '#mechanic-lesson-description', '.mechanic-lesson-tip']) {
        const text = lesson.locator(sel);
        await expect(text).toBeVisible();
        const box = (await text.boundingBox())!;
        expect(overlaps(portraitBox, box), `${sel} must not sit under the portrait`).toBe(false);
      }
      const button = page.getByTestId('button-dismiss-mechanic-lesson');
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      expect(await hitTestable(page, 'button-dismiss-mechanic-lesson')).toBe(true);
      await page.screenshot({ path: info.outputPath(`lesson-${vp.width}x${vp.height}.png`) });
      await button.click();
      await expect(lesson).toHaveCount(0);
      expect((await state(page)).lessonDismissed).toBe(1);
    });

    test('long Cornball cue scrolls by wheel, keeps Continue reachable, and suppresses duplicates', async ({ page }, info) => {
      await page.goto(fixture('cue'));
      const cue = page.getByTestId('guided-reading-cue');
      await expect(cue).toBeVisible();
      await expect(cue).toContainText('Cornball');
      const note = (await state(page)).cornballNote;
      expect(note.length).toBeGreaterThan(0);
      await expect(cue).toContainText(note.slice(0, 20));
      await expect(page.getByTestId('battle-phase-status')).toHaveAttribute('data-phase-status', 'effects');
      await expect(page.getByTestId('battle-phase-status')).toContainText('Effects resolve');
      await expect(page.getByTestId('battle-phase-status')).toContainText('Your');
      for (const hidden of ['battle-guidance', 'effect-causality', 'tutorial-event-summary', 'tutorial-round-summary', 'button-fast-forward']) {
        await expect(page.getByTestId(hidden)).toHaveCount(0);
      }
      await expect(page.locator('[aria-label^="Continue past"]')).toHaveCount(0);
      await expect(page.getByTestId('button-battle-history')).toHaveCount(1);
      await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-reading-cue', 'event');
      await expect(page.locator('.attack-caption:visible')).toHaveCount(0);
      await expect(page.locator('.ability-chain-banner:visible')).toHaveCount(0);
      const status = page.getByTestId('battle-phase-status');
      await expect(status.locator('b')).toHaveText('Effects resolve');
      await expect(status).toContainText('Your Cornball');
      const kicker = cue.locator('.guided-reading-cue__kicker');
      await expect(kicker).toHaveText('What just happened');
      const title = cue.locator('#guided-reading-title');
      for (const [name, loc] of [['phase status', status], ['cue kicker', kicker], ['cue title', title]] as const) {
        const box = (await loc.boundingBox())!;
        expect(inViewport(box, vp), `${name} in viewport`).toBe(true);
        const hit = await loc.evaluate(el => { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === el || el.contains(h)); });
        expect(hit, `${name} is topmost at its centre`).toBe(true);
        for (const sel of ['.attack-caption', '.ability-chain-banner']) {
          for (const other of await page.locator(sel).all()) {
            if (!(await other.isVisible())) continue;
            const ob = await other.boundingBox();
            if (ob) expect(overlaps(box, ob), `${sel} overlaps ${name}`).toBe(false);
          }
        }
      }
      const bodyEl = cue.locator('.guided-reading-cue__body');
      const scroll = await bodyEl.evaluate(el => ({ sh: el.scrollHeight, ch: el.clientHeight }));
      expect(scroll.sh, 'long cue body overflows its own box').toBeGreaterThan(scroll.ch);
      const bb = (await bodyEl.boundingBox())!;
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      for (let i = 0; i < 30; i += 1) await page.mouse.wheel(0, 400);
      await expect.poll(() => bodyEl.evaluate(el => Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 2)).toBe(true);
      const arenaScroll = await page.getByTestId('battle-arena').evaluate(el => el.scrollTop);
      expect(arenaScroll, 'the arena itself does not scroll').toBe(0);
      const cueBox = (await cue.boundingBox())!;
      expect(inViewport(cueBox, vp)).toBe(true);
      const lanes = page.locator('[data-testid^="lane-container-"]');
      await expect(lanes.first()).toBeVisible();
      const laneBox = (await lanes.first().boundingBox())!;
      expect(laneBox.y + 24, 'board stays visible below the cue').toBeLessThan(vp.height);
      const cont = page.getByTestId('button-continue-guided-reading');
      await expect(cont).toBeInViewport();
      expect(await hitTestable(page, 'button-continue-guided-reading')).toBe(true);
      await page.screenshot({ path: info.outputPath(`cue-${vp.width}x${vp.height}.png`) });
      await page.waitForTimeout(1500);
      await expect(cue, 'cue never auto-dismisses').toBeVisible();
      await cont.click();
      await expect(cue).toHaveCount(0);
      expect((await state(page)).cueContinued).toBe(1);
      await expect(page.getByTestId('battle-arena')).not.toHaveAttribute('data-reading-cue', /.+/);
    });

    test('rival phase status and final-board review without the finish cinematic', async ({ page }, info) => {
      await page.goto(fixture('rival'));
      await expect(page.getByTestId('battle-phase-status')).toHaveAttribute('data-phase-status', 'rival-reveal');
      await expect(page.getByTestId('battle-phase-status')).toContainText('Rival reveal');
      await page.goto(fixture('final'));
      await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-presentation-phase', 'match-finish');
      await expect(page.locator('.broadcast-overlay')).toHaveCount(0);
      await expect(page.getByText('FINAL DISTRICTS', { exact: true }).locator('visible=true')).toHaveCount(0);
      await expect(page.getByTestId('final-board-review')).toBeVisible();
      await expect(page.getByTestId('battle-phase-status')).toHaveAttribute('data-phase-status', 'match-complete');
      const lanes = page.locator('[data-testid^="lane-container-"]');
      await expect(lanes).toHaveCount(3);
      const tag = (await page.getByTestId('final-board-review').boundingBox())!;
      expect(tag.height).toBeLessThan(40);
      expect(inViewport(tag, vp), 'final-board marker inside viewport').toBe(true);
      await expect(page.getByTestId('battle-guidance').getByTestId('final-board-review'), 'marker renders in flow inside guidance').toHaveCount(1);
      expect(await page.getByTestId('final-board-review').evaluate(el => getComputedStyle(el).position)).toBe('static');
      expect(await hitTestable(page, 'final-board-review'), 'marker is not covered').toBe(true);
      await expect(page.getByText('Inspect cards and district scores at your own pace.')).toHaveCount(0);
      await expect(page.getByTestId('button-fast-forward')).toHaveCount(0);
      await expect(page.getByTestId('button-resolving')).toHaveText(/Match complete/i);
      await expect(page.getByTestId('button-resolving')).toBeDisabled();
      await expect(page.getByText('Resolving...')).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`final-${vp.width}x${vp.height}.png`) });
    });
  });
}
