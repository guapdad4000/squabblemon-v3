import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cardCatalog } from '../src/data';

// Controlled signed-in API fixtures: real Collection route, artwork and inspector.
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4195';
const beforeModule = process.env.COLLECTION_BEFORE_MODULE;
const beforeCss = process.env.COLLECTION_BEFORE_CSS;
const label = beforeModule ? 'before' : 'after';
// Optional future-roster stress: duplicate real card definitions/art only inside
// the intercepted test module. Production catalog and assets remain untouched.
const rosterSize = Math.max(cardCatalog.length, Number(process.env.COLLECTION_STRESS_TOTAL) || cardCatalog.length);
const artifactLabel = rosterSize > cardCatalog.length ? `${label}-stress-${rosterSize}` : label;
const output = 'screenshots/collection-performance';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results: unknown[] = [];
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 960 }], ['phone', { width: 390, height: 844 }]] as const) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let requests = 0;
    page.on('request', () => requests++);
    if (beforeModule || rosterSize > cardCatalog.length) await page.route('**/src/pages/game/Collection.tsx*', async route => {
      const body = beforeModule ? await readFile(beforeModule, 'utf8') : await (await route.fetch()).text();
      const stress = rosterSize > cardCatalog.length ? `\n{ const collectionStressBase = cardCatalog.slice(); while (cardCatalog.length < ${rosterSize}) { const index = cardCatalog.length; cardCatalog.push({ ...collectionStressBase[index % collectionStressBase.length], catalogId: 'collection-stress-' + index }); } }\n` : '';
      await route.fulfill({ contentType: 'text/javascript', body: body + stress });
    });
    if (beforeCss) await page.route('**/src/styles/collection.css*', async route => route.fulfill({ contentType: 'text/javascript', body: await readFile(beforeCss, 'utf8') }));
    const owned = cardCatalog.map(card => card.catalogId);
    for (let index = owned.length; index < rosterSize; index++) owned.push(`collection-stress-${index}`);
    const fixture = {
      profile: { id: 'collection-performance', displayName: 'Collector', avatarKey: 'cornball', onboardingStep: 'complete', starterDeckId: 'block', streetRep: 0, xp: 0, level: 1, softCurrency: 500, packTickets: 3, styleShards: 0, packPity: 0, deckSlots: 4, cosmeticCurrency: 0, collectionProgress: 0, storyChapter: 0, storyNode: 0, tutorialCompleted: true, starterRewardClaimed: true, ageConfirmedAt: new Date(0).toISOString(), termsAcceptedAt: new Date(0).toISOString(), settings: { reducedMotion: false, turnTimerEnabled: false }, ownedCardIds: owned, cardProgression: {}, discoveredCardIds: owned, ownedVariants: [], equippedVariants: {}, unlockedCosmeticIds: [], unlockedCharacterIds: [], savedDecks: [], storyProgress: {}, inbox: [], packHistory: [], lastActiveAt: new Date(0).toISOString() },
      missions: [], collectionRoad: [], nextAction: { id: 'play', eyebrow: 'Training', title: 'Test your idea', description: 'Build a gang', destination: 'play', rewardLabel: null }, packConfig: { id: 'street-pack', name: 'Street Pack', oddsVersion: 'e2e-v1', softCurrencyCost: 500, ticketCost: 1, rewardsPerPack: 3, pityLimit: 10, odds: [] },
    };
    await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/player/bootstrap') ? fixture : { chapters: [], nodes: [], pending: [], items: [], messages: [], ids: [], state: 'claimed', reward: {} } }));
    await page.goto(origin + '/game/collection');
    const grid = page.getByTestId('collection-card-grid');
    const controls = grid.getByTestId('collection-card-control');
    await controls.last().waitFor();
    await page.waitForTimeout(1500);
    const measure = () => grid.evaluate(element => {
      const area = element.closest('.collection-stage__body')!;
      const clip = area.getBoundingClientRect();
      const buttons = [...element.querySelectorAll<HTMLButtonElement>('[data-testid="collection-card-control"]')];
      const visible = buttons.filter(button => { const r = button.getBoundingClientRect(); return r.bottom > Math.max(clip.top, 0) && r.top < Math.min(clip.bottom, innerHeight); });
      return { total: buttons.length, mounted: element.querySelectorAll('.collector-card').length, nodes: element.querySelectorAll('*').length, scrollHeight: area.scrollHeight, width: area.clientWidth, scrollWidth: area.scrollWidth, visible: visible.length, visibleFaces: visible.filter(button => button.querySelector('.collector-card')).length, nonzero: visible.every(button => { const r = button.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), loaded: visible.every(button => [...button.querySelectorAll<HTMLImageElement>('img')].every(image => image.complete && image.naturalWidth > 0)) };
    });
    const initial = await measure();
    assert.equal(initial.total, rosterSize);
    assert.ok(initial.visible > 0 && initial.nonzero && initial.loaded, `${name}: visible artwork has real geometry and decoded images`);
    assert.equal(initial.visibleFaces, initial.visible);
    assert.ok(initial.scrollWidth <= initial.width + 1, `${name}: no sideways overflow`);
    if (!beforeModule) assert.ok(initial.mounted < initial.total / 2, `${name}: expensive faces are bounded`);
    const initialRequests = requests;
    await page.screenshot({ path: `${output}/${artifactLabel}-${name}.png` });
    const target = controls.last();
    const lastId = await target.getAttribute('data-collection-discovery-card-id');
    await target.focus(); // Browser focus scroll and our synchronous focused-card exception.
    await page.waitForTimeout(500);
    assert.equal(await target.locator('.collector-card').count(), 1, `${name}: deep keyboard target mounts full artwork`);
    await page.keyboard.press('Alt+Enter');
    const details = page.getByRole('dialog');
    await details.waitFor();
    await page.getByRole('button', { name: 'Close card details', exact: true }).click();
    await details.waitFor({ state: 'detached' });
    assert.equal(await target.evaluate(button => document.activeElement === button), true, `${name}: inspector restores focus`);
    const deep = await measure();
    assert.equal(deep.scrollHeight, initial.scrollHeight, `${name}: deferred faces do not change grid height`);
    assert.equal(deep.visibleFaces, deep.visible);
    if (!beforeModule) assert.ok(deep.mounted < deep.total / 2, `${name}: faces from the first viewport were released`);
    await grid.evaluate(element => element.closest('.collection-stage__body')!.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(600);
    const returnTop = await measure();
    assert.equal(returnTop.scrollHeight, initial.scrollHeight);
    assert.equal(returnTop.visibleFaces, returnTop.visible);
    await page.getByTestId('button-view-collection-road').click();
    await page.reload();
    await page.getByTestId('button-view-collection-road').waitFor();
    assert.equal(await page.getByTestId('button-view-collection-road').getAttribute('aria-pressed'), 'true', `${name}: Gang Wall selection survives reload`);
    await page.getByTestId('button-view-catalog').click();
    await grid.waitFor();
    await page.goto(origin + '/game/collection?card=' + encodeURIComponent(lastId!));
    const directTarget = page.locator(`[data-collection-discovery-card-id="${lastId}"]`);
    await directTarget.scrollIntoViewIfNeeded();
    await directTarget.locator('.collector-card').waitFor();
    await directTarget.click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(errors, [], `${name}: no browser exceptions`);
    const result = { label, name, initialRequests, initial, deep, returnTop, checks: 'visible geometry, artwork, bounded mounting, stable height, keyboard details/focus, deep scroll/revisit, direct-card link, remembered Gang Wall' };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/${artifactLabel}-report.json`, JSON.stringify(results, null, 2));
}
