import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const puzzles = JSON.parse(await readFile('../../design/story-puzzles-v2/inventory.json', 'utf8'));
const out = '../../screenshots/story-puzzles-v3';
const baseUrl = (process.env.STORY_PUZZLE_BASE_URL ?? 'http://127.0.0.1:4231').replace(/\/$/, '');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
});
const results = [];

try {
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['phone', 390, 844],
    ['short-phone', 360, 640],
    ['ipad-portrait', 768, 1024],
    ['ipad-landscape', 1024, 768],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height }, reducedMotion: 'reduce', hasTouch: name === 'phone',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    for (const puzzle of puzzles) {
      const label = `${name}/${puzzle.id}`;
      await page.goto(`${baseUrl}/e2e/season-theater.fixture.html?scenario=puzzle&puzzleNode=${puzzle.nodeId}`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      const dialog = page.getByRole('dialog', { name: puzzle.title, exact: true });
      await dialog.waitFor();
      assert.equal(await dialog.locator('.puzzle-scene img').count(), 1, `${label}: one illustration`);
      for (const image of await dialog.locator('img').all()) {
        await image.evaluate(image => image.decode());
        assert.ok(await image.evaluate(image => image.naturalWidth > 0), `${label}: decoded artwork`);
      }
      await page.evaluate(async () => { await document.fonts.ready; });
      assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${label}: dialog horizontal overflow`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: page horizontal overflow`);
      assert.equal(await dialog.locator('.puzzle-sequence, .puzzle-clue-lens').count(), 0, `${label}: no duplicated editor or clue lens`);
      assert.equal(await dialog.locator('.story-puzzle-list').count(), 1, `${label}: one evidence editor`);
      const layout = await dialog.getAttribute('data-layout');
      assert.equal(await dialog.locator('.house-route').count(), layout === 'route' ? 1 : 0, `${label}: route instrument only where relevant`);
      assert.equal(await dialog.locator('.house-pass').count(), layout === 'pass' ? 1 : 0, `${label}: pickup clock only where relevant`);
      const rows = dialog.locator('[data-puzzle-piece]');
      assert.equal(await rows.count(), puzzle.pieces.length, `${label}: complete evidence`);
      assert.equal(await dialog.locator('.story-puzzle-item-art').count(), 0, `${label}: no repeated decorative cards`);

      // Each piece owns exactly one full clue. Shared source clues can legitimately
      // occur on multiple pieces (the two damaged-space Sherlock tape splices).
      for (const piece of puzzle.pieces) {
        const row = dialog.locator(`[data-puzzle-piece="${piece.id}"]`);
        const clue = row.getByText(piece.detail, { exact: true });
        assert.equal(await clue.count(), 1, `${label}/${piece.id}: one full clue`);
        await clue.waitFor({ state: 'visible', timeout: 5000 });
        assert.ok(await clue.isVisible(), `${label}/${piece.id}: clue visible`);
        const descriptionId = await row.getAttribute('aria-describedby');
        assert.equal(await dialog.locator(`[id="${descriptionId}"]`).innerText(), piece.detail);
      }
      for (const detail of new Set(puzzle.pieces.map(piece => piece.detail))) {
        assert.equal(await dialog.getByText(detail, { exact: true }).count(), puzzle.pieces.filter(piece => piece.detail === detail).length, `${label}: no copied full clues`);
      }
      for (const row of await rows.all()) {
        for (const control of await row.locator('.story-puzzle-item-controls button').all()) {
          const box = await control.boundingBox();
          assert.ok(box && box.width >= 44 && box.height >= 44, `${label}: usable move controls`);
        }
      }
      assert.ok(await rows.first().getByRole('button', { name: `Move ${puzzle.pieces[0].label} up`, exact: true }).isDisabled());
      assert.ok(await rows.last().getByRole('button', { name: `Move ${puzzle.pieces.at(-1).label} down`, exact: true }).isDisabled());
      await rows.first().getByRole('button', { name: `Move ${puzzle.pieces[0].label} down`, exact: true }).click();
      assert.equal(await rows.nth(1).getAttribute('data-puzzle-piece'), puzzle.pieces[0].id, `${label}: direct move down`);
      await rows.nth(1).getByRole('button', { name: `Move ${puzzle.pieces[0].label} up`, exact: true }).click();
      assert.equal(await rows.first().getAttribute('data-puzzle-piece'), puzzle.pieces[0].id, `${label}: direct move up`);
      await dialog.evaluate(element => { element.scrollTop = 0; });
      if (name === 'desktop' || name === 'phone') {
        await page.screenshot({ path: `${out}/${name}-${puzzle.id}.png`, fullPage: true });
      }

      if (name === 'desktop' || name === 'short-phone') {
        const submit = dialog.locator('.story-puzzle-submit');
        const initial = await rows.evaluateAll(elements => elements.map(element => element.dataset.puzzlePiece));
        if (JSON.stringify(initial) !== JSON.stringify(puzzle.solution)) {
          await submit.click();
          await page.getByRole('alert').waitFor();
          assert.match(await page.getByRole('alert').innerText(), /not correct yet/);
        }
        await dialog.locator('.story-puzzle-hint-btn').click();
        assert.ok(await dialog.locator('.story-puzzle-hints-list').innerText());
        for (const [position, id] of puzzle.solution.entries()) {
          let order = await rows.evaluateAll(elements => elements.map(element => element.dataset.puzzlePiece));
          while (order.indexOf(id) > position) {
            const row = dialog.locator(`[data-puzzle-piece="${id}"]`);
            if (name === 'short-phone') {
              await row.focus();
              await row.press('ArrowUp');
            } else {
              await row.getByRole('button', { name: `Move ${puzzle.pieces.find(piece => piece.id === id).label} up`, exact: true }).click();
            }
            order = await rows.evaluateAll(elements => elements.map(element => element.dataset.puzzlePiece));
          }
        }
        assert.deepEqual(await rows.evaluateAll(elements => elements.map(element => element.dataset.puzzlePiece)), puzzle.solution);
        assert.deepEqual(await rows.locator('.story-puzzle-item-content strong').allTextContents(), puzzle.solution.map(id => puzzle.pieces.find(piece => piece.id === id).label));
        await submit.click();
        await page.getByText(puzzle.solvedText, { exact: true }).waitFor();
      }
      results.push({ viewport: name, puzzle: puzzle.id, solved: name === 'desktop' || name === 'short-phone' });
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${name}: ${puzzles.length} puzzles passed`);
  }
  await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
  console.log(`PASS ${results.length} puzzle viewport checks; ${results.filter(result => result.solved).length} solved arrangements.`);
} finally {
  await browser.close();
}
