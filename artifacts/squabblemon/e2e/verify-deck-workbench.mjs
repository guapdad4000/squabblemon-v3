import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { cardCatalog, starterRecipes } from '@workspace/squabblemon-engine/data';
import { assertDeckToolbarLayout } from './deck-toolbar-layout.mjs';

// Run through tsx because the engine package exports TypeScript source.
// Keep this test's auth flags and optimized modules away from the live preview.
const port = 4197;
process.env.PORT = String(port);
process.env.BASE_PATH = '/';
process.env.VITE_E2E_AUTH = 'true';
delete process.env.REPL_ID;
const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  cacheDir: '/tmp/squabblemon-deck-workbench-vite',
  server: { port, host: '127.0.0.1', strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
const origin = `http://127.0.0.1:${port}`;
const output = new URL('../../../screenshots/deck-workbench/', import.meta.url);
await mkdir(output, { recursive: true });
const ids = cardCatalog.map(card => card.catalogId);
const initialDeck = {
  id: 'layout-check', name: 'Starter Crew', cardIds: starterRecipes[0].catalogCardIds,
  heroCardId: starterRecipes[0].hero, recipeId: null, valid: true, issues: [],
};
const newIds = ids.filter(id => !initialDeck.cardIds.includes(id)).slice(-3);
const browserErrors = [];
const key = 'squabblemon:collection-card-discovery:v1:e2e-player';
const makeBootstrap = (withPack = false, mixedStates = false) => ({
  profile: {
    id: 'e2e-player', displayName: 'Test Player', avatarKey: 'cornball', onboardingStep: 'complete',
    starterDeckId: initialDeck.id, streetRep: 0, xp: 0, level: 1, softCurrency: 500,
    packTickets: 3, styleShards: 0, packPity: 0, deckSlots: 4, cosmeticCurrency: 0,
    collectionProgress: 0, storyChapter: 0, storyNode: 0, tutorialCompleted: true,
    starterRewardClaimed: true, ageConfirmedAt: new Date().toISOString(), termsAcceptedAt: new Date().toISOString(),
    settings: { reducedMotion: false, turnTimerEnabled: true }, ownedCardIds: mixedStates ? ids.slice(0, -2) : ids,
    discoveredCardIds: mixedStates ? ids.slice(0, -1) : ids, cardProgression: Object.fromEntries(ids.map(id => [id, { xp: 0, level: 1 }])),
    ownedVariants: [], equippedVariants: {}, unlockedCosmeticIds: [], unlockedCharacterIds: [],
    savedDecks: [initialDeck], storyProgress: {}, inbox: [], lastActiveAt: new Date().toISOString(),
    packHistory: withPack ? [{
      id: 'new-pack', oddsVersion: 'fixture', paymentMethod: 'ticket', cost: 1, pullCount: 1,
      pityBefore: 0, pityAfter: 1, createdAt: new Date().toISOString(),
      rewards: newIds.map(cardId => ({ kind: 'card', cardId, isNew: true, amount: 1, variantId: null, name: cardId, rarity: null })),
    }] : [],
  },
  missions: [], collectionRoad: mixedStates ? [
    { id: 'first-block', threshold: 5, title: 'First Block', description: 'Build the archive.', rewardLabel: 'Street pack', status: 'claimable' },
    { id: 'whole-neighborhood', threshold: 20, title: 'Whole Neighborhood', description: 'Keep collecting.', rewardLabel: 'Banner', status: 'locked' },
  ] : [],
  nextAction: { id: 'play', eyebrow: 'Tonight', title: 'Run the block', description: 'Play', destination: 'play', rewardLabel: null },
  packConfig: { id: 'pack', name: 'Pack', oddsVersion: '1', softCurrencyCost: 200, ticketCost: 1, rewardsPerPack: 6, pityLimit: 10, odds: [] },
  tenPullConfig: { id: 'ten', name: 'Ten packs', oddsVersion: '1', pullCount: 10, ticketCost: 9, softCurrencyCost: 1800, rewardsPerPull: 6, rarePityBonusPerPull: 1 },
});

async function setup(width, height, { withPack = false, reduce = false, returning = false, collection = false, mixedStates = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await context.addInitScript(({ initialDeck, key, ids, newIds, returning }) => {
    localStorage.setItem('squabblemon_e2e_user', 'signed-in');
    if (!localStorage.getItem('squabblemon.preview-decks.v1')) localStorage.setItem('squabblemon.preview-decks.v1', JSON.stringify([initialDeck]));
    if (returning && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      version: 1, knownCardIds: ids.filter(id => !newIds.includes(id)), pendingCardIds: [],
    }));
  }, { initialDeck, key, ids, newIds, returning });
  const page = await context.newPage();
  const errors = [];
  browserErrors.push({ viewport: `${width}x${height}`, errors });
  const missingResources = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const detail = `console: ${message.text()} (${message.location().url})`;
    if (/^Failed to load resource: the server responded with a status of 404/.test(message.text())) missingResources.push(detail);
    else errors.push(detail);
  });
  context.on('close', () => {
    if (missingResources.length) console.warn(`${width}x${height}: missing resources:\n${[...new Set(missingResources)].join('\n')}`);
  });
  const bootstrap = makeBootstrap(withPack, mixedStates);
  await page.route('**/api/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(new URL(route.request().url()).pathname.endsWith('/player/bootstrap') ? bootstrap : {}),
  }));
  await page.goto(`${origin}${collection ? '/game/collection' : '/game/decks/layout-check'}`);
  await page.locator(collection ? '[data-testid=collection-card-grid]' : '.deck-workbench__actions').waitFor();
  if (!collection) await page.waitForFunction(() => {
    const image = document.querySelector('.gang-backdrop img');
    return image?.complete && image.naturalWidth > 0;
  });
  return { context, page, errors, bootstrap };
}

async function hitTest(locator) {
  return locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && (hit === element || element.contains(hit));
  });
}

try {
  for (const [name, width, height] of process.argv[2] === 'paper' ? [
    ['desktop', 1280, 900], ['phone', 390, 844],
  ] : []) {
    const { context, page, errors } = await setup(width, height, { collection: true });
    await page.route('**/api/multiplayer', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ rooms: [] }),
    }));
    await page.goto(`${origin}/game/online?tab=friends`);
    const friend = page.getByRole('link', { name: /Friend fades/ });
    await friend.waitFor();
    const background = await friend.evaluate(element => getComputedStyle(element, '::before').backgroundImage);
    assert.ok(background.includes('/ripped-strip.webp'), 'Friend fades uses the full-width paper instead of the cutout');
    assert.ok(await hitTest(friend), 'The replacement leaves the tab clickable');
    await friend.click();
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'friends');
    await page.screenshot({ path: fileURLToPath(new URL(`paper-${name}.png`, output)) });
    await page.goto(`${origin}/game`);
    const welcome = page.locator('.safehouse-room-welcome .room-action');
    await welcome.waitFor();
    assert.ok((await welcome.evaluate(element => getComputedStyle(element, '::before').backgroundImage)).includes('/ripped-strip.webp'),
      'Safehouse actions also use the replacement paper');
    assert.ok(await hitTest(welcome), 'Safehouse action remains clickable');
    await page.screenshot({ path: fileURLToPath(new URL(`paper-safehouse-${name}.png`, output)) });
    assert.deepEqual(errors, []);
    console.log(`${name}: replacement paper and Friend fades navigation passed`);
    await context.close();
  }
  for (const [name, width, height] of process.argv[2] === 'details' ? [
    ['reported', 934, 776], ['desktop', 1440, 960], ['tablet', 820, 1180],
    ['phone', 390, 844], ['landscape', 844, 390],
  ] : []) {
    const { context, page, errors } = await setup(width, height, { collection: true });
    const recruit = page.getByTestId('collection-card-control').filter({ has: page.locator('[data-card-id="bus-pass"]') });
    await recruit.click();
    const dialog = page.getByRole('dialog', { name: 'Bus Pass card details' });
    await dialog.waitFor();
    await page.waitForTimeout(350);
    const geometry = await dialog.evaluate(element => {
      const layout = element.querySelector('.card-inspector-layout').getBoundingClientRect();
      const portrait = element.querySelector('.collector-display-stack').getBoundingClientRect();
      const card = element.querySelector('[data-testid="card-inspector"]').getBoundingClientRect();
      const scroller = element.querySelector('.card-inspector-scroll');
      return { layoutTop: layout.top, portraitTop: portrait.top, cardTop: card.top, cardBottom: card.bottom,
        overflow: scroller.scrollWidth > scroller.clientWidth + 1 };
    });
    assert.ok(Math.abs(geometry.portraitTop - geometry.layoutTop) <= 2, `${name}: card aligns with the top, not the center of the long dossier`);
    assert.ok(geometry.cardTop < 145 && geometry.cardBottom < height, `${name}: the whole card is visible immediately: ${JSON.stringify(geometry)}`);
    assert.equal(geometry.overflow, false, `${name}: no sideways overflow`);
    const close = page.getByRole('button', { name: 'Close card details', exact: true });
    assert.ok(await hitTest(close), 'Close is clickable above the artwork');
    await page.screenshot({ path: fileURLToPath(new URL(`details-${name}.png`, output)) });
    await page.locator('.card-inspector-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert.ok(await hitTest(close), 'Close remains clickable after reading the details');
    await close.click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await recruit.evaluate(element => element === document.activeElement), true, 'Closing restores collection focus');
    assert.deepEqual(errors, []);
    console.log(`${name}: top-aligned Bus Pass, immediate visibility, scrolling, and closing passed`);
    await context.close();
  }
  for (const [name, width, height] of [
    ['desktop', 1280, 900], ['wide-desktop', 1536, 960], ['reference', 1024, 640],
    ['wide-short', 1024, 500], ['tablet', 1024, 790], ['phone', 390, 844],
    ['small-phone', 320, 740], ['landscape', 844, 390], ['short-phone', 390, 500],
  ].filter(([name]) => !process.argv[2] || process.argv.slice(2).includes(name))) {
    const { context, page, errors } = await setup(width, height, { withPack: true });
    const search = page.getByRole('searchbox', { name: 'Browse your collection' });
    const save = page.getByRole('button', { name: 'Save deck', exact: true });
    const test = page.getByRole('button', { name: 'Test deck', exact: true });
    assert.equal(await page.getByRole('button', { name: /focus view/i }).count(), 0);
    assert.equal(await page.locator('[data-collection-discovery-active=true], [data-collection-discovery-new=true]').count(), 0, 'Deck Builder never tours or badges new cards');
    assert.equal(await page.locator('.deck-editor-nav').count(), 0, 'Old breadcrumb navigation is gone');
    assert.ok((await test.locator('img').getAttribute('src')).includes('fight-emblem'), 'Test Deck uses the fist emblem');
    const stageBox = await page.locator('.deck-editor-screen').boundingBox();
    const backdropBox = await page.locator('.deck-editor-screen > .gang-backdrop').boundingBox();
    assert.equal(backdropBox.y, stageBox.y, 'Wallpaper starts at the top of the editor');
    assert.ok(await hitTest(save), `${name}: Save is clickable before any scrolling`);
    const saveBox = await save.boundingBox(), testBox = await test.boundingBox();
    assert.ok(saveBox.width > testBox.width && saveBox.height >= testBox.height, 'Save is the primary action');
    assert.ok(await hitTest(test), `${name}: Test remains tappable`);
    assert.ok(await hitTest(page.getByRole('button', { name: 'Delete deck' })), `${name}: Delete deck remains tappable`);
    assert.equal(await search.evaluate(e => getComputedStyle(e).color), 'rgb(0, 0, 0)');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
    const compact = width <= 700 || (width <= 900 && height <= 550);
    const tabs = page.locator('.deck-workbench > .arsenal-paper-tabs');
    await assertDeckToolbarLayout(page, { name, width });
    if (compact) {
      const tabBox = await tabs.boundingBox();
      assert.ok(tabBox.height <= 58, `${name}: paper tabs use compact editor-specific height (${tabBox.height}px)`);
      for (const label of ['Collection', 'Decks']) {
        const tab = tabs.getByRole('link', { name: label });
        assert.ok(await hitTest(tab), `${name}: ${label} tab remains tappable`);
        assert.ok((await tab.boundingBox()).height >= 44, `${name}: ${label} has a usable tap target`);
      }
    }
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-initial.png`, output)) });
    const roster = page.getByTestId('deck-roster-grid');
    const slots = roster.locator('.deck-slot');
    assert.ok(await hitTest(slots.first().getByRole('button', { name: /as cover/ })), `${name}: cover control remains tappable`);
    const original = [...initialDeck.cardIds];
    await slots.nth(0).getByRole('button', { name: /^Replace / }).click();
    assert.ok(await page.getByRole('button', { name: 'Move earlier' }).isDisabled(), `${name}: first slot cannot move earlier`);
    await page.getByRole('button', { name: 'Cancel replacement' }).click();
    await slots.nth(9).getByRole('button', { name: /^Replace / }).click();
    assert.ok(await page.getByRole('button', { name: 'Move later' }).isDisabled(), `${name}: last slot cannot move later`);
    await page.getByRole('button', { name: 'Cancel replacement' }).click();
    await roster.evaluate(element => { element.scrollLeft = 0; });
    await page.evaluate(() => window.scrollTo(0, 0));
    await slots.nth(1).getByRole('button', { name: /^Replace / }).click();
    const selection = page.getByRole('group', { name: new RegExp(`Lineup slot 2: `) });
    assert.ok(await selection.isVisible());
    if (height <= 550) await selection.evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-selected.png`, output)) });
    if (compact) {
      const selectionBox = await selection.boundingBox(), rosterBox = await roster.boundingBox();
      assert.ok(selectionBox.y >= rosterBox.y + rosterBox.height - 1, `${name}: tools directly follow the lineup`);
      for (const label of ['Move earlier', 'Move later', 'Remove card', 'Cancel replacement']) {
        const action = selection.getByRole('button', { name: label });
        assert.ok((await action.boundingBox()).height >= 40, `${name}: ${label} has a usable target`);
        assert.ok(await hitTest(action), `${name}: ${label} is not covered`);
      }
      const removeBox = await selection.getByRole('button', { name: 'Remove card' }).boundingBox();
      const deleteBox = await page.getByRole('button', { name: 'Delete deck' }).boundingBox();
      assert.ok(removeBox.y > deleteBox.y + deleteBox.height, `${name}: remove card and delete deck are separate controls`);
    }
    await selection.getByRole('button', { name: 'Move earlier' }).click();
    assert.equal(await slots.nth(0).getByRole('button', { name: /^Replace / }).getAttribute('aria-label'), `Replace ${cardCatalog.find(card => card.catalogId === original[1]).name}`);
    assert.ok(await page.getByRole('button', { name: 'Move earlier' }).isDisabled(), `${name}: moving to the first slot updates disabled state`);
    await page.getByRole('button', { name: 'Move later' }).click();
    await page.getByRole('button', { name: 'Remove card' }).click();
    assert.equal(await slots.locator('button[aria-label^="Replace "]').count(), original.length - 1, `${name}: remove only removes a card`);
    assert.equal(await page.getByRole('button', { name: 'Delete deck' }).count(), 1, `${name}: whole deck deletion remains separate`);
    await page.getByRole('button', { name: 'Undo last change' }).click();
    assert.equal(await slots.locator('button[aria-label^="Replace "]').count(), original.length, `${name}: undo restores lineup`);
    await slots.nth(1).getByRole('button', { name: /^Replace / }).click();
    const recruit = page.locator('[data-testid=deck-collection-grid] > button').filter({ has: page.locator(`[data-card-id="${newIds[0]}"]`) });
    await recruit.click();
    assert.equal(await slots.nth(1).getByRole('button', { name: /^Replace / }).getAttribute('aria-label'), `Replace ${cardCatalog.find(card => card.catalogId === newIds[0]).name}`, `${name}: recruit swaps selected card`);
    await page.getByRole('button', { name: 'Undo last change' }).click();
    assert.equal(await slots.nth(1).getByRole('button', { name: /^Replace / }).getAttribute('aria-label'), `Replace ${cardCatalog.find(card => card.catalogId === original[1]).name}`, `${name}: undo restores the swap`);
    await page.locator('.deck-workbench__body').evaluate(body => {
      const cards = body.querySelector('.deck-workbench__card-scroll');
      const scroller = /auto|scroll/.test(getComputedStyle(cards).overflowY) ? cards : body;
      scroller.scrollTop = scroller.scrollHeight;
    });
    await page.waitForTimeout(180);
    assert.ok(await hitTest(search), `${name}: scrolled cards do not obscure search`);
    assert.ok(await hitTest(save), `${name}: cards do not obscure floating actions`);
    const last = page.locator('[data-testid=deck-collection-grid] > button').last();
    const lastBox = await last.boundingBox(), footer = await page.locator('.deck-workbench__actions').boundingBox();
    assert.ok(lastBox.y + lastBox.height <= footer.y + 1, `${name}: final card scrolls clear of footer`);
    const browseBox = await page.locator('.deck-workbench__browse').boundingBox();
    await page.screenshot({ path: fileURLToPath(new URL(`${name}-scrolled.png`, output)) });
    assert.ok(lastBox.y >= browseBox.y + browseBox.height, `${name}: final card clears the sticky search too: ${JSON.stringify({ lastBox, browseBox, footer })}`);
    assert.equal(await page.locator('.deck-workbench__browse').evaluate(browse => {
      const rect = browse.getBoundingClientRect();
      return [0.1, 0.5, 0.9].some(fraction => document.elementsFromPoint(rect.x + rect.width * fraction, rect.y + rect.height / 2)
        .some(element => element.closest('.deck-workbench__collection')));
    }), false, 'Cards are clipped below the whole recruit/search row, never behind it');
    await search.fill('cornball');
    assert.equal(await page.locator('[data-testid=deck-collection-grid] > button').count(), 1);
    assert.ok(await hitTest(search), 'Filtering leaves the search reachable');
    await search.fill('');
    await page.getByRole('textbox', { name: 'Deck name' }).fill('Saved Gang');
    await save.click();
    await page.getByText('Deck saved. Your lineup is ready.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1')).find(d => d.id === 'layout-check').name), 'Saved Gang');
    if (name === 'desktop') {
      await page.getByRole('textbox', { name: 'Deck name' }).fill('Unsaved Gang');
      await tabs.getByRole('link', { name: /Collection/ }).click();
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Stay here', exact: true }).click();
      assert.ok(page.url().endsWith('/game/decks/layout-check'), 'Removing the old nav preserves the exit guard');
    }
    await test.click();
    await page.waitForURL('**/game/decks/layout-check/test');
    await page.getByTestId('battle-arena').waitFor({ timeout: 20000 });
    if (name === 'desktop') {
      await page.goto(`${origin}/game/decks/layout-check`);
      await page.getByRole('button', { name: 'Delete deck', exact: true }).waitFor();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Delete deck', exact: true }).click();
      await page.waitForURL('**/game/decks');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1')).some(d => d.id === 'layout-check')), false);
    }
    assert.deepEqual(errors, []);
    console.log(`${name}: sticky search, scroll reachability, floating buttons, save, and test navigation passed`);
    await context.close();
  }

  for (const options of process.argv[2] && !['collection'].includes(process.argv[2]) ? [] : [{ withPack: true }, { returning: true }, { withPack: true, reduce: true }]) {
    const { context, page } = await setup(390, 844, { ...options, collection: true });
    if (options.reduce) {
      await page.waitForSelector('[data-collection-discovery-new=true]');
      assert.equal(await page.locator('[data-collection-discovery-active=true]').count(), 0, 'Reduced motion shows static new badges without auto-scrolling');
      assert.equal(await page.locator('[data-collection-discovery-new=true]').count(), newIds.length);
      await context.close();
      continue;
    }
    const expectedIds = options.returning ? [...newIds].sort((a, b) => a.localeCompare(b)) : newIds;
    for (let index = 0; index < newIds.length; index++) {
      const active = page.locator('[data-collection-discovery-active=true]');
      await page.waitForFunction(id => document.querySelector('[data-collection-discovery-active=true]')?.getAttribute('data-collection-discovery-card-id') === id, expectedIds[index]);
      assert.equal(await active.count(), 1, 'Only one new card is highlighted');
      assert.equal(await page.locator('[data-collection-discovery-new=true]').count(), newIds.length);
      assert.equal(await page.getByRole('button', { name: /skip tour|pause tour/i }).count(), 0, 'Collection has no tour control panel');
      await page.waitForTimeout(250);
      const rect = await active.boundingBox();
      const body = await page.locator('.collection-stage__body').boundingBox();
      assert.ok(rect.y >= body.y - 1 && rect.y + rect.height <= body.y + body.height, 'Highlight is visible in Collection');
      if (index === 0) await page.screenshot({ path: fileURLToPath(new URL(`collection-new-${options.returning ? 'returning' : options.reduce ? 'reduced' : 'pack'}.png`, output)) });
    }
    await page.waitForFunction(() => !document.querySelector('[data-collection-discovery-active=true]'));
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).pendingCardIds, key), []);
    await page.reload();
    await page.locator('[data-testid=collection-card-grid]').waitFor();
    assert.equal(await page.locator('[data-collection-discovery-active=true]').count(), 0, 'Completed tour does not replay');
    console.log(`Collection ${JSON.stringify(options)}: one-by-one highlight, visibility, reduced motion, and no replay passed`);
    await context.close();
  }

  for (const [name, width, height] of process.argv[2] && !['collection', 'layout'].includes(process.argv[2]) ? [] : [
    ['collection-desktop', 1280, 900], ['collection-phone', 390, 844],
  ]) {
    const { context, page, errors } = await setup(width, height, { collection: true, mixedStates: true });
    assert.equal(await page.getByRole('searchbox').count(), 0, `${name}: Collection has no search`);
    assert.equal(await page.getByText('Filters', { exact: true }).count(), 0, `${name}: Collection has no filters`);
    assert.equal(await page.getByTestId('collection-card-control').count(), ids.length, `${name}: full catalog is visible`);
    assert.equal(await page.locator('[data-collection-card-state=locked]').count(), 1, `${name}: locked cards remain distinct`);
    assert.equal(await page.locator('[data-collection-card-state=undiscovered]').count(), 1, `${name}: undiscovered cards remain distinct`);
    const hero = await page.locator('.collection-stage__hero').boundingBox();
    assert.ok(hero.height >= 180 && hero.height < height * .55, `${name}: hero stays readable without crowding the catalog`);
    const ownedCount = page.getByTestId('text-collection-owned');
    assert.equal(await ownedCount.getAttribute('aria-label'), `${ids.length - 2} of ${ids.length} cards owned`, `${name}: the full count is accessible during animation`);
    await page.waitForFunction(expected => document.querySelector('[data-testid="text-collection-owned"]')?.textContent?.trim() === expected, `${ids.length - 2} / ${ids.length}`);
    const title = await page.locator('.collection-hero__title').evaluate(element => ({
      content: element.scrollWidth,
      available: element.clientWidth,
      font: getComputedStyle(element).font,
    }));
    assert.ok(title.content <= title.available + 1, `${name}: collection heading fits without clipping (${title.content}px / ${title.available}px, ${title.font})`);
    assert.ok((await page.locator('.collection-stage__hero').evaluate(element => getComputedStyle(element).backgroundImage)).includes('collection-sunset-standoff'), `${name}: supplied wallpaper is installed`);
    const firstCard = page.getByTestId('collection-card-control').first();
    await firstCard.focus();
    assert.notEqual(await firstCard.evaluate(element => getComputedStyle(element).outlineStyle), 'none', `${name}: card keyboard focus is visible`);
    await firstCard.click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Close card details', exact: true }).click();
    await page.getByTestId('button-view-collection-road').click();
    await page.getByRole('region', { name: 'The Gang Wall' }).waitFor();
    const layers = page.getByRole('navigation', { name: 'Wall layers' });
    await layers.getByRole('button', { name: 'Rewards' }).click();
    assert.equal(await layers.getByRole('button', { name: 'Rewards' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('navigation', { name: 'Painted tags' }).getByRole('button', { name: /First Block/ }).count(), 1);
    await page.getByTestId('button-view-catalog').click();
    await page.getByTestId('collection-card-grid').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no horizontal overflow`);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: false });
    assert.deepEqual(errors, []);
    console.log(`${name}: hero, full catalog, card states, inspector, road, focus, and responsive layout passed`);
    await context.close();
  }

  if (process.argv[2] === 'layout') {
    const { context, page } = await setup(390, 844, { collection: true, mixedStates: true, reduce: true });
    assert.equal((await page.getByTestId('text-collection-owned').textContent())?.trim(), `${ids.length - 2} / ${ids.length}`, 'Reduced motion shows the final count immediately');
    await context.close();
  }

  for (const interruption of process.argv[2] && process.argv[2] !== 'collection' ? [] : ['wheel']) {
    const { context, page } = await setup(1280, 900, { withPack: true, collection: true });
    await page.locator('[data-collection-discovery-active=true]').waitFor();
    if (interruption === 'wheel') {
      await page.locator('.collection-stage__body').hover();
      await page.mouse.wheel(0, 100);
    }
    await page.waitForTimeout(1300);
    assert.equal(await page.locator('[data-collection-discovery-active=true]').count(), 0, 'User interaction stops auto scrolling');
    assert.ok((await page.evaluate(key => JSON.parse(localStorage.getItem(key)).pendingCardIds, key)).length > 0, 'Unshown cards remain pending');
    await context.close();
  }
  for (const { viewport, errors } of browserErrors) {
    assert.deepEqual(errors, [], `${viewport}: no browser runtime or console errors`);
  }
  console.log('PASS: Deck Builder floating controls and Collection new-card discovery.');
} finally {
  for (const { viewport, errors } of browserErrors) {
    if (errors.length) console.error(`${viewport} browser errors:\n${errors.join('\n')}`);
  }
  await browser.close();
  await server.close();
}