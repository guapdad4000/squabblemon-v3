const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const deckWrites = [], errors = [];
    page.on('request', request => { if (/\/api\/player\/decks\//.test(request.url()) && ['PUT','DELETE'].includes(request.method())) deckWrites.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.goto('http://localhost:4179/squabblemon/game/decks/block', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Save deck', exact: true }).click();
    await page.waitForURL(/\/game\/decks\/[a-f0-9-]{36}$/);
    const savedUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Delete deck', exact: true }).waitFor();
    assert.equal(await page.locator('.deck-workbench').count(), 1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1')).length), 1);
    await page.getByRole('button', { name: 'Save & test crew', exact: true }).click();
    await page.waitForURL(savedUrl + '/test');
    await page.getByTestId('battle-arena').waitFor();
    assert.equal(await page.getByRole('heading', { name: /Deck Not Found|Deck Is Not Ready/ }).count(), 0);
    await page.goto(savedUrl, { waitUntil: 'domcontentloaded' });
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete deck', exact: true }).click();
    await page.waitForURL('**/game/decks');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1')).length), 0);
    await page.getByRole('button', { name: 'New Deck', exact: true }).click();
    await page.waitForURL(/\/game\/decks\/[a-f0-9-]{36}$/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1'))[0].name), 'New Deck');
    assert.deepEqual(deckWrites, []);
    assert.deepEqual(errors, []);
    console.log('Preview: save starter copy, reload, save and test, delete, and create empty deck passed. No deck API requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
