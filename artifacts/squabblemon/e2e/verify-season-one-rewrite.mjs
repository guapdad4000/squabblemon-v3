import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const expectedLines = 2765;
const expectedSections = 113;
const viewports = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
];
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({ reducedMotion: 'reduce' });
page.on('pageerror', error => errors.push(error.message));
await page.goto(`${process.env.UI_ORIGIN ?? 'http://localhost:4207'}/e2e/season-one-readthrough.fixture.html`);
await page.waitForFunction(() => window.__reviewEntries?.length === 2765 && window.__reviewSections?.length === 113);
await page.evaluate(() => document.fonts.ready);
const normalLayoutPage = await browser.newPage({ reducedMotion: 'no-preference' });
normalLayoutPage.on('pageerror', error => errors.push(error.message));
await normalLayoutPage.goto(`${process.env.UI_ORIGIN ?? 'http://localhost:4207'}/e2e/season-one-readthrough.fixture.html`);
await normalLayoutPage.waitForFunction(() => window.__reviewEntries?.length === 2765 && window.__reviewSections?.length === 113);
await normalLayoutPage.evaluate(() => document.fonts.ready);
const layoutRuns = [
  { page, motion: 'reduced' },
  { page: normalLayoutPage, motion: 'normal' },
];
for (const run of layoutRuns) run.page.on('framenavigated', frame => {
  if (frame === run.page.mainFrame()) console.log(`Reader navigated during ${run.motion} verification: ${frame.url()}`);
});

const entries = await page.evaluate(() => window.__reviewEntries.map((entry, index) => ({
  index,
  text: entry.line.text,
  plain: entry.line.text.replaceAll('*', ''),
  sectionKey: entry.sectionKey,
  position: entry.position,
  total: entry.total,
})));
assert.equal(entries.length, expectedLines, 'read every line in the shipped Season One script');
const longestBySection = new Map();
for (const entry of entries) {
  const previous = longestBySection.get(entry.sectionKey);
  if (!previous || entry.text.length > previous.text.length) longestBySection.set(entry.sectionKey, entry);
}
assert.equal(longestBySection.size, expectedSections, 'all authored scene sections are present');

let layoutChecks = 0;
for (const [runIndex, run] of layoutRuns.entries()) {
  for (const viewport of viewports) {
    await run.page.setViewportSize(viewport);
    // Chromium updates dynamic viewport units on a rendering frame after the
    // viewport API returns. Measure the new size, not the preceding size.
    await run.page.waitForFunction(height => Math.abs(document.querySelector('main').getBoundingClientRect().height - height) < 1, viewport.height);
    for (const entry of longestBySection.values()) {
      await run.page.evaluate(index => window.__reviewSelect(index), entry.index);
      try {
        await run.page.waitForFunction(index => window.__reviewIndex === index, entry.index);
      } catch (error) {
        console.error('Selection did not settle', { motion: run.motion, viewport, expectedIndex: entry.index, actual: await run.page.evaluate(() => ({ index: window.__reviewIndex, hasSelect: typeof window.__reviewSelect, line: document.querySelector('.story-stage__line')?.textContent })) });
        throw error;
      }
      if (run.motion === 'normal') await run.page.locator('.story-stage__next').click();
      try {
        await run.page.waitForFunction(text => document.querySelector('.story-stage__line')?.textContent === text, entry.plain);
      } catch (error) {
        console.error('Failed authored line', { motion: run.motion, viewport, entry, actual: await run.page.evaluate(() => ({ index: window.__reviewIndex, line: document.querySelector('.story-stage__line')?.textContent, motionOff: document.querySelector('.story-stage__header button[aria-pressed]')?.getAttribute('aria-pressed') })) });
        await run.page.screenshot({ path: 'e2e/screenshots/season-one/readthrough-failure.png' });
        throw error;
      }
      const result = await run.page.evaluate(() => {
        const stage = document.querySelector('.story-stage');
        const line = document.querySelector('.story-stage__line');
        const footer = document.querySelector('.story-stage__script footer');
        const controls = [...document.querySelectorAll('.story-stage__header button, .story-stage__script footer button')];
        const rects = [stage, line, footer, ...controls].map(element => element.getBoundingClientRect());
        const [stageRect, lineRect, footerRect] = rects;
        return {
          visible: rects.every(rect => rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1),
          hitTestable: controls.every(element => {
            const rect = element.getBoundingClientRect();
            const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return target === element || element.contains(target);
          }),
          lineBeforeFooter: lineRect.bottom <= footerRect.top + 1,
          lineFits: line.scrollHeight <= line.clientHeight + 1,
          counter: document.querySelector('.story-stage__speaker small')?.textContent,
          text: line.textContent,
          stageHeight: stageRect.height,
          disabledTranscript: document.querySelector('.story-stage__script footer button')?.disabled,
        };
      });
      assert.ok(result.visible, `${run.motion} ${viewport.width}x${viewport.height}: controls and dialogue fit: ${result.text}`);
      assert.ok(result.hitTestable, `${run.motion} ${viewport.width}x${viewport.height}: a reading control is covered`);
      assert.ok(result.lineBeforeFooter, `${run.motion} ${viewport.width}x${viewport.height}: dialogue overlaps actions: ${result.text}`);
      assert.ok(result.lineFits, `${run.motion} ${viewport.width}x${viewport.height}: dialogue is clipped: ${result.text}`);
      assert.ok(result.counter?.includes(`${entry.position.toString().padStart(2, '0')} / ${entry.total.toString().padStart(2, '0')}`), 'scene counter is visible');
      assert.equal(result.disabledTranscript, false, 'transcript action remains enabled');
      assert.equal(await run.page.locator('.story-stage--still').count(), 0, 'normal-motion layout checks must not disable stage motion');
      layoutChecks++;
    }
    await run.page.evaluate(index => window.__reviewSelect(index), 0);
    await run.page.waitForFunction(() => window.__reviewIndex === 0);
    if (run.motion === 'normal') await run.page.locator('.story-stage__next').click();
    await run.page.waitForFunction(() => document.querySelector('.story-stage__line')?.textContent === window.__reviewEntries[0].line.text.replaceAll('*', ''));
    await run.page.screenshot({ path: `e2e/screenshots/season-one/${run.motion}-${viewport.width}x${viewport.height}.png` });

    await run.page.locator('.story-stage__script footer button').nth(0).click();
    assert.equal(await run.page.evaluate(() => window.__reviewActions.history), viewports.indexOf(viewport) + 1, 'transcript callback is reachable');
    await run.page.locator('.story-stage__header button').nth(1).click();
    assert.equal(await run.page.locator('.story-stage__header button').nth(1).getAttribute('aria-pressed'), 'true', 'motion preference control is reachable');
    await run.page.locator('.story-stage__script footer button').nth(1).click();
    assert.equal(await run.page.evaluate(() => window.__reviewActions.skip), viewports.indexOf(viewport) + 1, 'skip callback is reachable');
    const expectedAfterSkip = entries[0].total;
    await run.page.waitForFunction(index => window.__reviewIndex === index, expectedAfterSkip);
    await run.page.locator('.story-stage__header button').nth(0).click();
    assert.equal(await run.page.evaluate(() => window.__reviewActions.close), viewports.indexOf(viewport) + 1, 'back callback is reachable');
    await run.page.waitForFunction(() => window.__reviewIndex === 0);

    await run.page.evaluate(() => window.__reviewSetError('Progress could not be saved. Try again before continuing.'));
    await run.page.waitForSelector('.story-stage__error[role="alert"]');
    const errorFits = await run.page.evaluate(() => {
      const alert = document.querySelector('.story-stage__error');
      const next = document.querySelector('.story-stage__next');
      const a = alert.getBoundingClientRect(), b = next.getBoundingClientRect();
      return a.top >= 0 && a.bottom <= innerHeight && a.bottom <= b.top && b.bottom <= innerHeight;
    });
    assert.ok(errorFits, `${run.motion} ${viewport.width}x${viewport.height}: save error covers a reading action`);
    await run.page.evaluate(() => window.__reviewSetError(null));
    console.log(`${run.motion}: all ${expectedSections} longest sections and reachable actions checked at ${viewport.width}x${viewport.height}.`);
  }
}

// The regular-motion reader must wait for an explicit first tap to finish the
// type-on and a second tap to move on; neither line completion nor time does.
const normalPage = await browser.newPage({ reducedMotion: 'no-preference' });
normalPage.on('pageerror', error => errors.push(error.message));
await normalPage.goto(`${process.env.UI_ORIGIN ?? 'http://localhost:4207'}/e2e/season-one-readthrough.fixture.html`);
await normalPage.waitForFunction(() => window.__reviewEntries?.length === 2765);
const revealEntry = entries.reduce((longest, entry) => entry.text.length > longest.text.length ? entry : longest, entries[0]);
await normalPage.evaluate(index => window.__reviewSelect(index), revealEntry.index);
await normalPage.waitForFunction(index => window.__reviewIndex === index, revealEntry.index);
await normalPage.locator('.story-stage__next').click();
await normalPage.waitForFunction(() => document.querySelector('.story-stage__line')?.textContent?.trim().length > 0);
const revealedIndex = await normalPage.evaluate(() => window.__reviewIndex);
assert.equal(revealedIndex, revealEntry.index, 'first tap reveals without advancing');
await normalPage.waitForTimeout(100);
assert.equal(await normalPage.evaluate(() => window.__reviewIndex), revealEntry.index, 'reading never auto-advances');
await normalPage.locator('.story-stage__next').click();
await normalPage.waitForFunction(index => window.__reviewIndex === index + 1, revealEntry.index);

// Traverse every beat using the real Continue control, then hit the final
// action to prove it is wired to the authored completion callback.
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(index => window.__reviewSelect(index), 0);
await page.waitForFunction(() => window.__reviewIndex === 0
  && document.querySelector('.story-stage__line')?.textContent === window.__reviewEntries[0].line.text.replaceAll('*', ''));
for (let index = 0; index < expectedLines - 1; index += 1) {
  await page.locator('.story-stage__next').click();
  await page.waitForFunction(value => {
    const expected = window.__reviewEntries[value].line.text.replaceAll('*', '');
    return window.__reviewIndex === value
      && document.querySelector('.story-stage__line')?.textContent === expected;
  }, index + 1);
  if ((index + 1) % 250 === 0) console.log(`Readthrough: ${index + 1}/${expectedLines} real Continue clicks verified.`);
}
assert.equal(await page.locator('[data-testid="review-progress"]').textContent(), `${expectedLines}/${expectedLines}`);
assert.equal(await page.evaluate(() => window.__reviewActions.next), expectedLines - 1, 'every next action was delivered');
assert.equal(await page.locator('.story-stage__next').textContent(), 'Continue →', 'the last story action is presented as continuation');
await page.locator('.story-stage__next').click();
await page.waitForFunction(value => window.__reviewActions.next === value, expectedLines);
assert.deepEqual(errors, []);
console.log(`${expectedLines} lines, ${expectedSections} sections, ${layoutChecks} normal/reduced-motion scene/viewport checks and manual readthrough callbacks passed.`);
await browser.close();