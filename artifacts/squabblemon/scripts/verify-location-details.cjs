const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4213';
const output = process.env.REVIEW_OUTPUT || '/tmp/location-details-review';
const artwork = [];
const responsive = [];
const errors = [];

async function assertNoOverflow(dialog, width, height) {
  const bounds = await dialog.boundingBox();
  assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, 'Location popup stays inside the viewport');
  const overflow = await dialog.evaluate(node => ({ popup: node.scrollWidth - node.clientWidth, content: [...node.querySelectorAll('.battle-district-view__content')].map(content => content.scrollWidth - content.clientWidth), body: document.documentElement.scrollWidth - innerWidth }));
  assert.ok(overflow.popup <= 1 && overflow.content.every(delta => delta <= 1) && overflow.body <= 1, `No horizontal overflow: ${JSON.stringify(overflow)}`);
}

async function assertLocation(dialog, entry) {
  assert.equal(await dialog.locator('nav').count(), 0, 'Solo location omits other locations');
  assert.equal(await dialog.locator('[data-card-zone="board"]').count(), 0, 'Solo location omits fighter cards');
  assert.equal(await dialog.locator('details, summary').count(), 0, 'Location rules do not require opening a toggle');
  assert.doesNotMatch(await dialog.innerText(), /\d+\s+fighters/i, 'Solo location omits fighter counts');
  assert.equal(await dialog.getByTestId('location-rule').locator('p').innerText(), entry.rule, 'The issued match rule is shown verbatim');
  assert.ok(await dialog.getByTestId('location-rule').isVisible(), 'The rule is always shown');
  if (entry.strategy) {
    assert.equal(await dialog.getByTestId('location-strategy').locator('p').innerText(), entry.strategy, 'The issued strategy is shown verbatim');
    assert.ok(await dialog.getByTestId('location-strategy').isVisible());
  }
  if (entry.status) assert.equal(await dialog.getByTestId('location-status').locator('p').innerText(), entry.status, 'Live status remains separate from the authored rule');
  const description = dialog.getByTestId('location-description');
  assert.ok((await description.innerText()).trim().length >= 20, 'Location has a short description');
  const scene = dialog.locator('img.battle-location-scene');
  await scene.waitFor();
  await scene.evaluate(image => image.decode());
  const image = await scene.evaluate(node => ({ source: node.currentSrc, width: node.naturalWidth, height: node.naturalHeight }));
  assert.ok(image.width > 100 && image.height > 100, `Location artwork loaded: ${entry.id}`);
  assert.ok([`/assets/locations/${entry.id}.webp`, `/assets/locations/${entry.id}-node.webp`].includes(new URL(image.source).pathname), `Correct art for ${entry.id}: ${image.source}`);
  const imageBounds = await scene.boundingBox();
  const descriptionBounds = await description.boundingBox();
  assert.ok(descriptionBounds.y >= imageBounds.y + imageBounds.height - 1, 'Description follows the picture');
  return image;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/e2e/location-details.fixture.html`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('location-details-opener').waitFor();
    const entries = await page.evaluate(() => window.__locationDetailsFixture.entries);
    assert.equal(entries.length, 30, 'All current and legacy artwork IDs are covered');
    assert.equal(new Set(entries.map(entry => entry.id)).size, 30);
    for (const [index, entry] of entries.entries()) {
      await page.getByRole('combobox', { name: 'Review location' }).selectOption(String(index));
      await page.getByTestId('location-details-opener').click();
      const dialog = page.getByRole('dialog', { name: `${entry.name} district view`, exact: true });
      await dialog.waitFor();
      const image = await assertLocation(dialog, entry);
      await assertNoOverflow(dialog, 1280, 900);
      if (['bodega', 'pirate-radio', 'blackout-block', 'community-kitchen'].includes(entry.id)) {
        await page.screenshot({ path: `${output}/1280-${entry.id}.png` });
      }
      const description = await dialog.getByTestId('location-description').innerText();
      artwork.push({ id: entry.id, name: entry.name, image, description, issuedRule: true, alwaysVisible: true });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(await page.getByTestId('location-details-opener').evaluate(node => node === document.activeElement), 'Escape returns focus to its opener');
    }
    assert.equal(new Set(artwork.map(location => location.description)).size, 30, 'Each location has its own description');
    await page.close();

    for (const [width, height, id] of [[320, 568, 'bodega'], [390, 844, 'pirate-radio'], [844, 390, 'construction-site'], [1280, 900, 'the-subway']]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/e2e/location-details.fixture.html?id=${id}&issued`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('location-details-opener').waitFor();
      const fixture = await page.evaluate(() => window.__locationDetailsFixture);
      const entry = fixture.entries.find(location => location.id === id);
      const issued = { ...entry, rule: fixture.issuedRule, strategy: fixture.issuedStrategy, status: 'Issued-match status: The opening discount is still available.' };
      await page.getByTestId('location-details-opener').click();
      const dialog = page.getByRole('dialog', { name: `${entry.name} district view`, exact: true });
      await dialog.waitFor();
      await assertLocation(dialog, issued);
      await assertNoOverflow(dialog, width, height);
      if (width === 320) {
        const rule = await dialog.getByTestId('location-rule').locator('p').boundingBox();
        const content = await dialog.locator('.battle-district-view__content').boundingBox();
        const lineHeight = await dialog.getByTestId('location-rule').locator('p').evaluate(node => parseFloat(getComputedStyle(node).lineHeight));
        assert.ok(rule.y >= content.y && rule.y + lineHeight <= content.y + content.height + 1, 'The first rule line is readable before scrolling on a short phone');
      }
      await page.screenshot({ path: `${output}/${width}-${id}-location.png` });
      for (const testId of ['location-rule', 'location-strategy', 'location-status']) {
        const detail = dialog.getByTestId(testId);
        await detail.scrollIntoViewIfNeeded();
        const bounds = await detail.boundingBox();
        assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1, `${testId} is reachable by scrolling`);
      }
      await page.screenshot({ path: `${output}/${width}-${id}-rules.png` });
      for (let tab = 0; tab < 8; tab++) {
        await page.keyboard.press('Tab');
        assert.ok(await dialog.evaluate(node => node.matches(':modal') && (node.contains(document.activeElement) || document.activeElement === document.body)), 'Native modal keeps the underlying application out of the focus cycle');
      }
      await dialog.getByRole('button', { name: 'View fighters here', exact: true }).click();
      assert.equal(await dialog.locator('nav button').count(), 3, 'Formation view keeps the approved location navigation');
      assert.equal(await dialog.locator('[data-card-zone="board"]').count(), 2, 'Formation shows both teams at this location');
      assert.equal(await dialog.locator('details, summary').count(), 0, 'Formation rules also remain visible');
      await dialog.locator('nav button').nth(1).click();
      const current = page.getByRole('dialog', { name: /district view/ });
      assert.equal(await current.locator('[data-card-zone="board"]').count(), 2);
      await current.locator('[data-card-zone="board"]').first().click();
      await page.getByTestId('button-close-inspector').waitFor();
      await page.getByTestId('button-close-inspector').click();
      await page.getByTestId('button-close-inspector').waitFor({ state: 'hidden' });
      await current.getByRole('button', { name: 'Location details', exact: true }).click();
      const solo = page.getByRole('dialog', { name: /district view/ });
      assert.equal(await solo.locator('nav').count(), 0, 'Returning to details hides other locations again');
      assert.equal(await solo.locator('[data-card-zone="board"]').count(), 0);
      await assertNoOverflow(solo, width, height);
      await page.keyboard.press('Escape');
      await solo.waitFor({ state: 'hidden' });
      assert.ok(await page.getByTestId('location-details-opener').evaluate(node => node === document.activeElement));
      await page.getByTestId('location-details-opener').click();
      await page.getByRole('dialog', { name: /district view/ }).getByRole('button', { name: 'Back to board', exact: true }).click();
      assert.equal(await page.getByRole('dialog', { name: /district view/ }).count(), 0);
      responsive.push({ width, height, id, issuedMatchText: true, detailsAlwaysVisible: true, soloOnly: true, formationSwitch: true, cardInspection: true, keyboard: true, overflow: false });
      await page.close();
    }
    for (const [width, height] of [[390, 844], [1280, 900]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/e2e/battle-mobile.fixture.html?locations=bodega,pirate-radio,construction-site`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('battle-arena').waitFor();
      await page.evaluate(() => Promise.race([Promise.all([...document.images].filter(image => image.loading !== 'lazy').map(image => image.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 2000))]));
      await page.screenshot({ path: `${output}/${width}-actual-board.png` });
      await page.getByTestId('district-details-1').click();
      const dialog = page.getByRole('dialog', { name: 'PIRATE RADIO district view', exact: true });
      await dialog.waitFor();
      const pirate = entries.find(entry => entry.id === 'pirate-radio');
      const image = await assertLocation(dialog, { ...pirate, status: 'Exactly 2 allies needed to broadcast' });
      await assertNoOverflow(dialog, width, height);
      await page.screenshot({ path: `${output}/${width}-pirate-radio-actual-location.png` });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.ok(await page.getByTestId('district-details-1').evaluate(node => node === document.activeElement), 'Real board location opener regains focus');
      responsive.push({ width, height, id: 'pirate-radio', actualBattle: true, realRule: pirate.rule, realStatus: 'Exactly 2 allies needed to broadcast', image, soloOnly: true, keyboard: true, overflow: false });
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    fs.writeFileSync(`${output}/browser.json`, JSON.stringify({ artwork, responsive, errors }, null, 2));
  }
  console.log(JSON.stringify({ artworkCount: artwork.length, responsive, errors }, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
